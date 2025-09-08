# shared/secrets.py
import os
from functools import lru_cache

def _use_kv() -> bool:
    return bool(os.getenv("KEY_VAULT_URI"))

@lru_cache(maxsize=1)
def _kv_client():
    if not _use_kv():
        return None
    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient
    return SecretClient(vault_url=os.environ["KEY_VAULT_URI"],
                        credential=DefaultAzureCredential())

def get_secret(name: str, default: str | None = None) -> str | None:
    # 1) env var wins (handy for local dev)
    if (v := os.getenv(name)) not in (None, ""):
        return v
    if (v := os.getenv(name.replace("-", "_"))) not in (None, ""):
        return v
    # 2) Key Vault (when KEY_VAULT_URI is set, e.g., in Azure)
    client = _kv_client()
    if client:
        try:
            return client.get_secret(name).value
        except Exception:
            pass
    # 3) default
    return default
