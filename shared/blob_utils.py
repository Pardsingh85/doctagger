import os
import json
from azure.storage.blob import BlobServiceClient
from datetime import datetime
from .secrets import get_secret

# ✅ Load .env from project root
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(dotenv_path=env_path)

AZURE_CONNECTION_STRING = get_secret("AzureStorage-ConnectionString") or os.getenv("AZURE_STORAGE_CONNECTION_STRING")

def get_blob_client(tenant_id: str, blob_name: str):
    """
    Returns a blob client for a specific tenant and blob file.
    Container name is derived from tenant_id by replacing '@' and '.'.
    """
    if not tenant_id or not blob_name:
        raise ValueError(f"Missing tenant_id or blob_name → tenant_id={tenant_id}, blob_name={blob_name}")

    container_name = tenant_id.lower().replace("@", "_").replace(".", "_")
    try:
        service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        container = service.get_container_client(container_name)
        try:
            container.create_container()
        except Exception:
            pass  # Container already exists
        return container.get_blob_client(blob_name)
    except Exception as e:
        print(f"[ERROR] Failed to get blob client for {tenant_id}/{blob_name}: {e}")
        raise

def load_json_blob(tenant_id: str, blob_name: str):
    """
    Loads a JSON blob for a given tenant. Returns parsed JSON or empty list on failure.
    """
    try:
        blob = get_blob_client(tenant_id, blob_name)
        raw = blob.download_blob().readall()
        return json.loads(raw)
    except Exception as e:
        print(f"[ERROR] load_json_blob failed: tenant={tenant_id}, blob={blob_name}, error={e}")
        return []

def write_json_blob(tenant_id: str, blob_name: str, data):
    """
    Writes JSON data to the specified blob, overwriting any existing contents.
    """
    try:
        blob = get_blob_client(tenant_id, blob_name)
        blob.upload_blob(json.dumps(data, indent=2), overwrite=True)
    except Exception as e:
        print(f"[ERROR] write_json_blob failed: tenant={tenant_id}, blob={blob_name}, error={e}")
        raise

def append_log_entry(tenant_id: str, entry: dict, blob_name="upload_log.json"):
    """
    Appends a new log entry to the tenant's upload_log.json file in blob storage.
    """
    try:
        logs = load_json_blob(tenant_id, blob_name)
        logs.append(entry)
        write_json_blob(tenant_id, blob_name, logs)
    except Exception as e:
        print(f"[ERROR] append_log_entry failed: tenant={tenant_id}, error={e}")

def update_daemon_status(tenant_id: str, label: str, update: dict):
    """
    Updates the daemon_status.json blob for a specific tenant and label.
    Creates the file if it doesn't exist.
    """
    try:
        filename = "daemon_status.json"
        data = load_json_blob(tenant_id, filename) or {}

        if tenant_id not in data:
            data[tenant_id] = {}

        if label not in data[tenant_id]:
            data[tenant_id][label] = {}

        # Update only the fields provided
        data[tenant_id][label].update(update)
        data[tenant_id][label]["last_updated"] = datetime.utcnow().isoformat() + "Z"

        write_json_blob(tenant_id, filename, data)

    except Exception as e:
        print(f"[ERROR] update_daemon_status failed: tenant={tenant_id}, label={label}, error={e}")
