# doctagger_backend/routes/upload_targets.py
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from ..auth_jwt import require_admin_jwt  # ✅ JWT-based admin gate
from shared.blob_utils import load_json_blob, write_json_blob

router = APIRouter(prefix="/admin/upload-targets", tags=["Upload Targets"])

def _normalize_targets(targets: List[dict]) -> List[dict]:
    for t in targets:
        if "enabled" not in t:
            t["enabled"] = True
    return targets

def load_targets(tid: str) -> List[dict]:
    data = load_json_blob(tid, "upload_targets.json")
    return _normalize_targets(data or [])

def save_targets(tid: str, data: List[dict]):
    write_json_blob(tid, "upload_targets.json", data)

def get_tid_from_token(user=Depends(require_admin_jwt)) -> str:
    tid = user.get("tid")
    if not tid:
        raise HTTPException(status_code=401, detail="Missing tenant ID")
    return tid

@router.get("")
def get_upload_targets(tid: str = Depends(get_tid_from_token)):
    return load_targets(tid)

@router.post("")
def add_upload_target(target: dict, tid: str = Depends(get_tid_from_token)):
    required_fields = ["label", "siteId", "driveId", "folder"]
    if not all(k in target for k in required_fields):
        raise HTTPException(status_code=400, detail="Missing required target fields.")

    tenant_targets = load_targets(tid)

    if any(t.get("label") == target.get("label") for t in tenant_targets):
        raise HTTPException(status_code=409, detail="Target with this label already exists.")

    target["enabled"] = bool(target.get("enabled", True))
    tenant_targets.append(target)
    save_targets(tid, tenant_targets)
    return {"message": "Upload target added."}

@router.delete("")
def delete_upload_target(label: str, tid: str = Depends(get_tid_from_token)):
    tenant_targets = load_targets(tid)
    new_targets = [t for t in tenant_targets if t.get("label") != label]
    if len(new_targets) == len(tenant_targets):
        raise HTTPException(status_code=404, detail="Label not found.")
    save_targets(tid, new_targets)
    return {"message": "Upload target deleted."}

@router.patch("/enabled")
def set_upload_target_enabled(label: str, enabled: bool, tid: str = Depends(get_tid_from_token)):
    tenant_targets = load_targets(tid)
    found = False
    for t in tenant_targets:
        if t.get("label") == label:
            t["enabled"] = bool(enabled)
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Label not found.")
    save_targets(tid, tenant_targets)
    return {"message": f"Target '{label}' set to enabled={bool(enabled)}"}

@router.get("/status")
def get_daemon_status(tid: str = Depends(get_tid_from_token)):
    try:
        data = load_json_blob(tid, "daemon_status.json")
        return data or {}
    except Exception:
        return {}
