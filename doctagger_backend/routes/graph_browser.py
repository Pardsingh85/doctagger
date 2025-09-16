# doctagger_backend/routes/graph_browser.py
from fastapi import APIRouter, Depends, HTTPException, Query
from ..auth_jwt import require_admin_jwt  # ✅ JWT-based admin gate
from doc_tagger_daemon.shared.graph_auth import get_graph_token
import requests
from urllib.parse import urlparse

router = APIRouter(prefix="/graph", tags=["Graph Browser"])

@router.get("/sites")
def list_sites(user=Depends(require_admin_jwt)):
    tid = user.get("tid")
    token = get_graph_token(tid)
    headers = {"Authorization": f"Bearer {token}"}

    url = "https://graph.microsoft.com/v1.0/sites?search=."
    resp = requests.get(url, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    sites = resp.json().get("value", [])
    return [{"name": s.get("name"), "id": s.get("id"), "webUrl": s.get("webUrl")} for s in sites]

@router.get("/drives")
def list_drives(siteId: str = Query(...), user=Depends(require_admin_jwt)):
    tid = user.get("tid")
    token = get_graph_token(tid)
    headers = {"Authorization": f"Bearer {token}"}

    url = f"https://graph.microsoft.com/v1.0/sites/{siteId}/drives"
    resp = requests.get(url, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    drives = resp.json().get("value", [])
    return [{"name": d.get("name"), "id": d.get("id")} for d in drives]

@router.get("/resolve-site")
def resolve_site(url: str, user=Depends(require_admin_jwt)):
    tid = user.get("tid")
    token = get_graph_token(tid)
    parsed = urlparse(url)
    hostname = parsed.hostname
    path_parts = parsed.path.strip("/").split("/")

    if not hostname or len(path_parts) < 2 or path_parts[0].lower() != "sites":
        raise HTTPException(status_code=400, detail="Invalid SharePoint site URL")

    site_path = "/".join(path_parts[:2])
    graph_url = f"https://graph.microsoft.com/v1.0/sites/{hostname}:/{site_path}"
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(graph_url, headers=headers)
    if resp.status_code != 200:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text or "Unknown error"
        raise HTTPException(status_code=resp.status_code, detail=str(detail))

    return resp.json()

@router.get("/folders")
def list_folders(siteId: str, driveId: str, user=Depends(require_admin_jwt)):
    tid = user.get("tid")
    token = get_graph_token(tid)
    headers = {"Authorization": f"Bearer {token}"}

    folder_paths = []

    def fetch_children(folder_path=""):
        url = f"https://graph.microsoft.com/v1.0/sites/{siteId}/drives/{driveId}/root"
        if folder_path:
            url += f":/{folder_path}:/children"
        else:
            url += f"/children"

        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            return

        for item in resp.json().get("value", []):
            if item.get("folder"):
                name = item["name"]
                full_path = f"{folder_path}/{name}".strip("/")
                folder_paths.append({
                    "name": full_path if full_path else "/",
                    "path": full_path
                })
                fetch_children(full_path)

    folder_paths.append({"name": "/", "path": ""})
    fetch_children()
    return folder_paths
