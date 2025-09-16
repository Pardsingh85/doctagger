# doctagger_backend/routes/sharepoint.py
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from ..auth_jwt import require_user_jwt  # ✅ JWT-based user gate
from doc_tagger_daemon.shared.graph_auth import get_graph_token
from doc_tagger_daemon.shared.blob_utils import append_log_entry, load_json_blob
from datetime import datetime
import requests

router = APIRouter()

@router.post("/upload-to-sharepoint")
async def upload_to_sharepoint(
    file: UploadFile = File(...),
    tags: str = Form(...),
    upload_target_label: str = Form(...),
    user=Depends(require_user_jwt),
):
    tid = user.get("tid")
    if not tid:
        raise HTTPException(status_code=401, detail="Missing tenant ID")

    # Load tenant-specific upload targets
    targets = load_json_blob(tid, "upload_targets.json") or []
    target = next((t for t in targets if t.get("label") == upload_target_label), None)
    if not target:
        raise HTTPException(status_code=403, detail="Unauthorized upload target.")

    site_id = target["siteId"]
    drive_id = target["driveId"]
    folder = target.get("folder", "").strip("/")

    token = get_graph_token(tid)
    headers = {"Authorization": f"Bearer {token}"}

    file_bytes = await file.read()
    filename = file.filename
    sp_path = f"{folder}/{filename}" if folder else filename

    # Upload file to SharePoint
    upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{sp_path}:/content"
    upload_resp = requests.put(upload_url, headers=headers, data=file_bytes)
    if upload_resp.status_code not in (200, 201):
        raise HTTPException(status_code=upload_resp.status_code, detail=f"Upload failed: {upload_resp.text}")

    item = upload_resp.json()
    file_id = item.get("id")
    web_url = item.get("webUrl")

    # Patch metadata tags
    if tags and file_id:
        patch_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/listItem/fields"
        patch_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        patch_body = {"DocTaggerTags": tags}
        patch_resp = requests.patch(patch_url, headers=patch_headers, json=patch_body)
        if patch_resp.status_code not in (200, 204):
            # Non-fatal: log but don't fail the whole request
            print("Metadata patch failed:", patch_resp.text)

    # Log to blob
    append_log_entry(
        tid,
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "filename": filename,
            "folder": folder or "/",
            "tags": [t.strip() for t in tags.split(",")] if tags else [],
            "user": user.get("email") or user.get("name"),
            "status": "success",
            "method": "manual",
        },
    )

    return {"ok": True, "item": {"webUrl": web_url, "id": file_id}}
