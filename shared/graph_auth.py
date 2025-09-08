# shared/graph_auth.py
import os, httpx
from .secrets import get_secret

DAEMON_CLIENT_ID = get_secret("Graph-ClientId") or os.getenv("DAEMON_CLIENT_ID")
DAEMON_CLIENT_SECRET = get_secret("Graph-ClientSecret") or os.getenv("DAEMON_CLIENT_SECRET")

def get_graph_token(tenant_id: str) -> str:
    if not (DAEMON_CLIENT_ID and DAEMON_CLIENT_SECRET):
        raise RuntimeError("Daemon credentials missing (Graph-ClientId/Graph-ClientSecret).")
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": DAEMON_CLIENT_ID,
        "client_secret": DAEMON_CLIENT_SECRET,
        "grant_type": "client_credentials",
        "scope": "https://graph.microsoft.com/.default",
    }
    resp = httpx.post(token_url, data=data, timeout=15)
    resp.raise_for_status()
    return resp.json()["access_token"]
