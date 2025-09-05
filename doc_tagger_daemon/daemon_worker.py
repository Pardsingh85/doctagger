import os
import io
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI
import requests

from shared.blob_utils import append_log_entry, load_json_blob, update_daemon_status
from shared.tagging_utils import extract_text, get_tags, parse_tags
from shared.graph_auth import get_graph_token


# Load .env vars
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def already_tagged(fields):
    return fields.get("DocTaggerTags") not in [None, ""]

def list_files(site_id, drive_id, folder, token):
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{folder}:/children"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print(f"[ERROR] Failed to list files: {resp.status_code} → {resp.text}")
        return []
    return resp.json().get("value", [])

def get_file_fields(site_id, drive_id, file_id, token):
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/listItem/fields"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers)
    return resp.json() if resp.status_code == 200 else {}

def download_file(site_id, drive_id, file_id, token):
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/content"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers)
    return resp.content if resp.status_code == 200 else None

def patch_metadata(site_id, drive_id, file_id, tags, token):
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/listItem/fields"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"DocTaggerTags": tags}
    resp = requests.patch(url, headers=headers, json=payload)
    if resp.status_code not in (200, 204):
        print(f"[WARN] Failed to patch metadata: {resp.status_code} → {resp.text}")

def process_target(tenant_id, target):
    label = target["label"]
    site_id = target["siteId"]
    drive_id = target["driveId"]
    folder = target["folder"]

    print(f"\n=== Processing '{label}' for tenant ===")

    update_daemon_status(tenant_id, label, {
        "last_run": datetime.utcnow().isoformat() + "Z",
        "files_processed": 0,
        "last_error": None
    })

    try:
        token = get_graph_token(tenant_id)
        print(f"[DEBUG] Auth success for tenant")
    except Exception as e:
        print(f"[ERROR] Auth failed for tenant")
        update_daemon_status(tenant_id, label, {
            "last_error": str(e)
        })
        return

    files = list_files(site_id, drive_id, folder, token)
    print(f"[DEBUG] Found {len(files)} files in '{folder}'")

    processed = 0

    for f in files:
        if not f.get("file"):
            continue
        name = f["name"]
        file_id = f["id"]

        print(f"[DEBUG] Evaluating file: {name}")
        fields = get_file_fields(site_id, drive_id, file_id, token)

        if already_tagged(fields):
            print(f"[SKIP] Already tagged: {name}")
            continue

        file_bytes = download_file(site_id, drive_id, file_id, token)
        if not file_bytes:
            print(f"[WARN] Failed to download {name}")
            continue

        class DummyFile:
            def __init__(self, filename, content):
                self.filename = filename
                self.file = io.BytesIO(content)

        dummy = DummyFile(name, file_bytes)

        try:
            text = extract_text(dummy)
            raw_tags = get_tags(text[:3000])
            tags = parse_tags(raw_tags)

            patch_metadata(site_id, drive_id, file_id, ", ".join(tags), token)
            print(f"[OK] Tagged {name}: {tags}")
            processed += 1

            append_log_entry(tenant_id, {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "filename": name,
                "folder": folder,
                "tags": tags,
                "user": "daemon@doctagger",
                "status": "success",
                "method": "daemon"
            })
            print(f"[DEBUG] Logged tagging for {name}")

        except Exception as e:
            print(f"[ERROR] Failed to tag {name}: {e}")
            update_daemon_status(tenant_id, label, {
                "last_error": str(e)
            })

    print(f"[INFO] Done with '{label}' — Files tagged: {processed}")

    update_daemon_status(tenant_id, label, {
        "last_success": datetime.utcnow().isoformat() + "Z",
        "files_processed": processed
    })

def load_config(tenant_id):
    print(f"[DEBUG] Loading upload_targets.json for")
    return load_json_blob(tenant_id, "upload_targets.json")

def get_tenant_ids():
    # 1) Prefer env var for quick testing
    csv = os.getenv("DAEMON_TENANTS")  # e.g. "tenantGuid1,tenantGuid2"
    if csv:
        return [t.strip() for t in csv.split(",") if t.strip()]

    # 2) (Optional) Central list in blob: tenants.json -> ["<tid>", ...]
    try:
        tenants = load_json_blob("global", "tenants.json")  # adjust container/key if needed
        if isinstance(tenants, list):
            return tenants
    except Exception:
        pass

    print("[WARN] No tenants configured (DAEMON_TENANTS empty, tenants.json not found).")
    return []

def run_daemon():
    tenant_ids = get_tenant_ids()
    for tenant_id in tenant_ids:
        if not tenant_id:
            print("[SKIP] Invalid tenant_id")
            continue

        print(f"[INFO] Starting processing for tenant: {tenant_id}")
        try:
            targets = load_config(tenant_id)
            if not targets:
                print(f"[INFO] No upload targets found for tenant: {tenant_id}")
                continue

            for target in targets:
                if not target.get("enabled", True):
                    print(f"[SKIP] Target '{target.get('label')}' is disabled (tenant {tenant_id})")
                    continue
                process_target(tenant_id, target)

        except Exception as e:
            print(f"[ERROR] Failed to process tenant {tenant_id}: {e}")

if __name__ == "__main__":
    print("🚀 Daemon started")
    run_daemon()

