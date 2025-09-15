# shared/secrets.py
from __future__ import annotations
import os
from functools import lru_cache
from typing import Optional

def _kv_uri() -> Optional[str]:
    return os.getenv("KEY_VAULT_URI")

@lru_cache(maxsize=1)
def _kv_client():
    """
    Lazily creates a Key Vault Secrets client when KEY_VAULT_URI is set.
    Prefers the user-assigned managed identity via AZURE_CLIENT_ID if present.
    """
    vault = _kv_uri()
    if not vault:
        return None
    # Import here to avoid import-time failures breaking function discovery
    from azure.identity import ManagedIdentityCredential, DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient

    client_id = os.getenv("AZURE_CLIENT_ID")  # UAMI client id (doctagger-uami)
    if client_id:
        cred = ManagedIdentityCredential(client_id=client_id)
    else:
        # Works locally (az login) and in Azure (uses system-assigned MI if enabled)
        cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)

    return SecretClient(vault_url=vault, credential=cred)

def get_secret(name: str, default: Optional[str] = None) -> Optional[str]:
    """
    Secret resolution order:
      1) Exact env var: NAME
      2) Env var with '-' → '_' (e.g., OpenAI-ApiKey → OPENAI_API_KEY)
      3) Azure Key Vault secret NAME (if KEY_VAULT_URI is set)
      4) Provided default
    """
    # 1) Exact (as provided)
    v = os.getenv(name)
    if v not in (None, ""):
        return v

    # 2) Dashed → underscored variant, uppercased
    alt = name.replace("-", "_")
    v = os.getenv(alt) or os.getenv(alt.upper())
    if v not in (None, ""):
        return v

    # 3) Key Vault
    client = _kv_client()
    if client:
        try:
            return client.get_secret(name).value
        except Exception:
            # Intentionally swallow to keep the daemon resilient; caller can decide fallback
            pass

    # 4) Default
    return default
