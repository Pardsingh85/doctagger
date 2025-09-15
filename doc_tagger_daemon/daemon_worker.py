# daemon_worker.py
# Clean, import-safe worker for Azure Functions (Python v2).
# - No side effects at import time
# - All clients/secrets created at runtime
# - Simple retry/backoff for Graph HTTP calls
# - Uses shared/* helpers only inside functions

from __future__ import annotations

import io
import os
import json
import time
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple, Callable
from shared.secrets import get_secret

# ------------- Helpers (no network at import) ----------------

@dataclass
class Target:
    label: str
    site_id: str
    drive_id: str
    folder: str
    enabled: bool = True


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _retryable_request(
    fn,
    max_attempts: int = 5,
    base_sleep: float = 0.8,
    max_sleep: float = 10.0,
):
    """
    Retry wrapper for transient Graph errors (429/5xx).
    Respects Retry-After header when present.
    """
    import requests  # imported here to avoid top-level side effects

    attempt = 0
    resp: Optional[requests.Response] = None
    while attempt < max_attempts:
        attempt += 1
        try:
            resp = fn()
            if resp.status_code < 400 or (400 <= resp.status_code < 500 and resp.status_code != 429):
                return resp
        except requests.RequestException:
            pass  # network error → retry

        # calculate backoff
        retry_after = 0.0
        if resp is not None:
            ra = resp.headers.get("Retry-After")
            try:
                retry_after = float(ra) if ra is not None else 0.0
            except ValueError:
                retry_after = 0.0

        sleep_s = max(retry_after, min(max_sleep, base_sleep * (2 ** (attempt - 1))))
        time.sleep(sleep_s)

    # out of attempts → return last resp or raise
    if resp is None:
        raise RuntimeError("Request failed after retries with no response object.")
    return resp


# ------------- Graph IO (created at runtime) -----------------

def _graph_get(url: str, token: str) -> Dict[str, Any]:
    import requests

    def _do():
        return requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=60)

    resp = _retryable_request(_do)
    if not resp or resp.status_code >= 400:
        raise RuntimeError(f"Graph GET failed {resp.status_code if resp else '??'}: {url} :: {getattr(resp, 'text', '')[:2000]}")
    return resp.json()


def _graph_get_bytes(url: str, token: str) -> bytes:
    import requests

    def _do():
        return requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=300)

    resp = _retryable_request(_do)
    if not resp or resp.status_code >= 400:
        raise RuntimeError(f"Graph GET(bytes) failed {resp.status_code if resp else '??'}: {url}")
    return resp.content


def _graph_patch(url: str, token: str, payload: Dict[str, Any]) -> None:
    import requests

    def _do():
        return requests.patch(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            data=json.dumps(payload).encode("utf-8"),
            timeout=60,
        )

    resp = _retryable_request(_do)
    if not resp or resp.status_code >= 400:
        raise RuntimeError(f"Graph PATCH failed {resp.status_code if resp else '??'}: {url} :: {getattr(resp, 'text', '')[:2000]}")


# ------------- Business logic (runtime imports) --------------

def _list_files(site_id: str, drive_id: str, folder: str, token: str) -> List[Dict[str, Any]]:
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{folder}:/children"
    data = _graph_get(url, token)
    return data.get("value", [])


def _get_file_fields(site_id: str, drive_id: str, file_id: str, token: str) -> Dict[str, Any]:
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/listItem/fields"
    return _graph_get(url, token)


def _download_file(site_id: str, drive_id: str, file_id: str, token: str) -> bytes:
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/content"
    return _graph_get_bytes(url, token)


def _patch_metadata(site_id: str, drive_id: str, file_id: str, tags_csv: str, token: str) -> None:
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/listItem/fields"
    _graph_patch(url, token, {"DocTaggerTags": tags_csv})


def _already_tagged(fields: Dict[str, Any]) -> bool:
    value = fields.get("DocTaggerTags")
    return value not in (None, "")


# ------------- Entry points (called by function) -------------

def _load_targets_for_tenant(tenant_id: str) -> List[Target]:
    # Lazy import shared helpers at runtime
    from shared.blob_utils import load_json_blob

    cfg = load_json_blob(tenant_id, "upload_targets.json") or []
    out: List[Target] = []
    for t in cfg:
        out.append(
            Target(
                label=t.get("label", "Unnamed"),
                site_id=t["siteId"],
                drive_id=t["driveId"],
                folder=t.get("folder", ""),
                enabled=t.get("enabled", True),
            )
        )
    return out


def _get_tenant_ids() -> List[str]:
    # Prefer env list
    csv = os.getenv("DAEMON_TENANTS", "")
    if csv.strip():
        return [t.strip() for t in csv.split(",") if t.strip()]

    # Optional: load from blob (safe fallback)
    try:
        from shared.blob_utils import load_json_blob
        tenants = load_json_blob("global", "tenants.json")
        if isinstance(tenants, list):
            return [t for t in tenants if isinstance(t, str) and t.strip()]
    except Exception:
        pass

    return []

from openai import OpenAI

def _make_openai_client():
    # First try Key Vault
    key = get_secret("OpenAI-ApiKey")

    # Fallback to env var (useful for local dev / quick test)
    if not key:
        key = os.getenv("OPENAI_API_KEY")

    if not key:
        raise RuntimeError("OpenAI API key not set (neither OpenAI-ApiKey in Key Vault nor OPENAI_API_KEY env var)")

    return OpenAI(api_key=key)


def _get_graph_token_for_tenant(tenant_id: str) -> str:
    # Lazy import auth helper
    from shared.graph_auth import get_graph_token
    return get_graph_token(tenant_id)


def _append_log(tenant_id: str, entry: Dict[str, Any]) -> None:
    from shared.blob_utils import append_log_entry
    append_log_entry(tenant_id, entry)


def _update_status(tenant_id: str, label: str, patch: Dict[str, Any]) -> None:
    from shared.blob_utils import update_daemon_status
    update_daemon_status(tenant_id, label, patch)


def _extract_and_tag(client, content_bytes: bytes, filename: str) -> List[str]:
    """
    Uses shared.tagging_utils helpers + OpenAI to extract and parse tags.
    """
    from shared.tagging_utils import extract_text, get_tags, parse_tags

    class _Dummy:
        def __init__(self, name: str, data: bytes) -> None:
            self.filename = name
            self.file = io.BytesIO(data)

    text = extract_text(_Dummy(filename, content_bytes))
    raw = get_tags(text[:3000])  # keep prompt size bounded
    tags = parse_tags(raw)
    return tags


def _process_target(tenant_id: str, target: Target, client) -> int:
    """
    Returns number of files successfully tagged for this target.
    """
    token = _get_graph_token_for_tenant(tenant_id)
    logging.info("[tenant=%s] Auth OK for target '%s'", tenant_id, target.label)

    files = _list_files(target.site_id, target.drive_id, target.folder, token)
    logging.info("[tenant=%s] Found %d files in '%s'", tenant_id, len(files), target.folder)

    processed = 0
    for f in files:
        # skip folders
        if not f.get("file"):
            continue

        name = f.get("name", "")
        fid = f.get("id")
        if not fid:
            continue

        try:
            fields = _get_file_fields(target.site_id, target.drive_id, fid, token)
        except Exception as e:
            logging.warning("[tenant=%s] Get fields failed for %s: %s", tenant_id, name, e)
            continue

        if _already_tagged(fields):
            logging.info("[tenant=%s] SKIP already tagged: %s", tenant_id, name)
            continue

        try:
            blob = _download_file(target.site_id, target.drive_id, fid, token)
        except Exception as e:
            logging.warning("[tenant=%s] Download failed for %s: %s", tenant_id, name, e)
            continue

        try:
            tags = _extract_and_tag(client, blob, name)
            tags_csv = ", ".join(tags)
            _patch_metadata(target.site_id, target.drive_id, fid, tags_csv, token)
            processed += 1

            _append_log(tenant_id, {
                "ts": _utc_now_iso(),
                "filename": name,
                "folder": target.folder,
                "tags": tags,
                "user": "daemon@doctagger",
                "status": "success",
                "method": "daemon",
            })
            logging.info("[tenant=%s] OK tagged %s -> %s", tenant_id, name, tags)

        except Exception as e:
            logging.exception("[tenant=%s] Tagging failed for %s: %s", tenant_id, name, e)
            _update_status(tenant_id, target.label, {"last_error": str(e)})

    return processed


def run_daemon() -> None:
    """
    Main entrypoint called by the timer trigger. Safe to import.
    """
    logging.info("daemon run start")
    tenants = _get_tenant_ids()
    if not tenants:
        logging.warning("No tenants configured (DAEMON_TENANTS / tenants.json).")
        return

    client = _make_openai_client()

    for tid in tenants:
        try:
            targets = _load_targets_for_tenant(tid)
        except Exception as e:
            logging.exception("[tenant=%s] Failed to load targets: %s", tid, e)
            continue

        if not targets:
            logging.info("[tenant=%s] No upload targets.", tid)
            continue

        for t in targets:
            if not t.enabled:
                logging.info("[tenant=%s] SKIP disabled target '%s'", tid, t.label)
                continue

            _update_status(tid, t.label, {
                "last_run": _utc_now_iso(),
                "files_processed": 0,
                "last_error": None,
            })

            try:
                count = _process_target(tid, t, client)
                _update_status(tid, t.label, {
                    "last_success": _utc_now_iso(),
                    "files_processed": count,
                })
            except Exception as e:
                logging.exception("[tenant=%s] Target '%s' failed: %s", tid, t.label, e)
                _update_status(tid, t.label, {"last_error": str(e)})

    logging.info("daemon run end")
