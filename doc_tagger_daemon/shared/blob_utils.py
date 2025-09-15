# shared/blob_utils.py
from __future__ import annotations
import os
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from .secrets import get_secret

def _conn_str() -> str:
    """
    Resolve Azure Storage connection string from:
      - Key Vault secret 'AzureStorage-ConnectionString', or
      - env var 'AZURE_STORAGE_CONNECTION_STRING'
    """
    return get_secret("AzureStorage-ConnectionString", default=os.getenv("AZURE_STORAGE_CONNECTION_STRING")) or ""

def _service_client():
    """
    Create a BlobServiceClient on demand. Import lazily.
    """
    from azure.storage.blob import BlobServiceClient
    conn = _conn_str()
    if not conn:
        raise RuntimeError("Azure Storage connection string not set (Key Vault 'AzureStorage-ConnectionString' or env 'AZURE_STORAGE_CONNECTION_STRING').")
    return BlobServiceClient.from_connection_string(conn)

def _container_name(tenant_id: str) -> str:
    return tenant_id.lower().replace("@", "_").replace(".", "_")

def get_blob_client(tenant_id: str, blob_name: str):
    """
    Returns a blob client for 'tenant_id' and 'blob_name'.
    Creates the container if it doesn't exist.
    """
    if not tenant_id or not blob_name:
        raise ValueError(f"Missing tenant_id or blob_name → tenant_id={tenant_id}, blob_name={blob_name}")
    service = _service_client()
    container = service.get_container_client(_container_name(tenant_id))
    try:
        container.create_container()
    except Exception:
        pass
    return container.get_blob_client(blob_name)

def load_json_blob(tenant_id: str, blob_name: str):
    """
    Loads a JSON blob; returns [] or {} on missing/empty blob.
    """
    try:
        blob = get_blob_client(tenant_id, blob_name)
        raw = blob.download_blob().readall()
        txt = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw
        return json.loads(txt)
    except Exception:
        # Return a sensible empty structure based on filename
        return {} if blob_name.endswith(".json") else []

def write_json_blob(tenant_id: str, blob_name: str, data):
    blob = get_blob_client(tenant_id, blob_name)
    blob.upload_blob(json.dumps(data, indent=2), overwrite=True)

def append_log_entry(tenant_id: str, entry: dict, blob_name: str = "upload_log.json"):
    logs = load_json_blob(tenant_id, blob_name) or []
    if not isinstance(logs, list):
        logs = []
    logs.append(entry)
    write_json_blob(tenant_id, blob_name, logs)

def update_daemon_status(tenant_id: str, label: str, update: dict):
    filename = "daemon_status.json"
    data = load_json_blob(tenant_id, filename) or {}
    if tenant_id not in data:
        data[tenant_id] = {}
    if label not in data[tenant_id]:
        data[tenant_id][label] = {}
    data[tenant_id][label].update(update)
    data[tenant_id][label]["last_updated"] = datetime.utcnow().isoformat() + "Z"
    write_json_blob(tenant_id, filename, data)
