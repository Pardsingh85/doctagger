# doctagger_backend/auth_jwt.py
"""
JWT validator for DocTagger AI (multi-tenant, v2.0 tokens).

- Validates Microsoft Entra ID (Azure AD) access tokens issued per-tenant.
- Uses OIDC discovery for the *token's* tenant (tid) to get the canonical issuer and JWKS.
- Verifies signature + audience, then checks issuer explicitly (with a helpful error if it mismatches).
- Exposes FastAPI dependencies: `require_user_jwt` and `require_admin_jwt`.

ENV:
  API_APP_ID = <GUID of DocTaggerAI-API app registration>   # GUID only, no 'api://' prefix
"""
import os
import httpx
import jwt
from jwt import PyJWKClient
from cachetools import TTLCache
from fastapi import Header, HTTPException, Depends

# ---- Config ----
API_APP_ID = os.getenv("API_APP_ID")  # GUID only (used below as api://<GUID>)
if not API_APP_ID:
    raise RuntimeError("API_APP_ID missing from environment")
AUDIENCE = f"api://{API_APP_ID}"

# Cache OIDC metadata per tenant (and let PyJWKClient handle key caching)
_OIDC_CACHE = TTLCache(maxsize=200, ttl=3600)


# ---- Helpers ----
def _get_oidc_config(tenant_id: str) -> dict:
    """Fetch v2.0 OIDC discovery for a tenant (cached)."""
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing tenant id (tid)")

    cached = _OIDC_CACHE.get(tenant_id)
    if cached:
        return cached

    url = f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"
    try:
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"OIDC discovery failed: {e}")

    data = resp.json()
    _OIDC_CACHE[tenant_id] = data
    return data


def _extract_bearer(auth_header: str | None) -> str:
    """Extract the raw JWT from an Authorization header."""
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return auth_header.split(" ", 1)[1].strip()


def _validate_access_token(token: str) -> dict:
    """
    Validate the token:
      1) Read unverified claims to get tid (tenant).
      2) Fetch tenant-specific discovery to get issuer + jwks_uri.
      3) Verify signature + audience (issuer verified manually for clearer errors).
    """
    # 1) Read unverified claims
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token: unreadable")

    tid = unverified.get("tid")
    token_iss = (unverified.get("iss") or "").strip()
    if not tid or not token_iss:
        raise HTTPException(status_code=401, detail="Invalid token: missing tid/iss")

    # 2) Tenant discovery
    oidc = _get_oidc_config(tid)
    expected_iss = (oidc.get("issuer") or "").strip()
    jwks_uri = oidc.get("jwks_uri")
    if not expected_iss or not jwks_uri:
        raise HTTPException(status_code=401, detail="OIDC discovery missing issuer/jwks_uri")

    # 3) Signature + audience
    try:
        jwks_client = PyJWKClient(jwks_uri)
        signing_key = jwks_client.get_signing_key_from_jwt(token).key

        # Verify signature and audience first; postpone issuer so we can emit a precise message.
        allowed_audiences = [
            API_APP_ID,                # bare GUID (your token currently has this)
            f"api://{API_APP_ID}",     # URI form (some setups issue this)
        ]
        custom_aud = os.getenv("API_APP_AUDIENCE")
        if custom_aud:
            allowed_audiences.append(custom_aud)

        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=allowed_audiences,
            options={"require": ["aud", "exp", "iss"], "verify_iss": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid audience")
    except Exception:
        # Keep this general to avoid leaking internals
        raise HTTPException(status_code=401, detail="Invalid token")

    # 4) Explicit issuer check with safe normalization (avoids trailing-slash issues)
    if token_iss.rstrip("/") != expected_iss.rstrip("/"):
        raise HTTPException(
            status_code=401,
            detail=f"Invalid issuer: token iss='{token_iss}' expected='{expected_iss}'",
        )

    return claims


# ---- Public dependencies ----
def require_user_jwt(authorization: str = Header(None)):
    """FastAPI dependency: validates access token and returns a lightweight user dict."""
    token = _extract_bearer(authorization)
    claims = _validate_access_token(token)
    return {
        "name": claims.get("name") or claims.get("preferred_username") or claims.get("upn"),
        "email": claims.get("preferred_username") or claims.get("upn"),
        "oid": claims.get("oid"),
        "tid": claims.get("tid"),
        "roles": claims.get("roles", []),  # app roles (for application permissions or admin role)
        "scp": claims.get("scp", ""),       # delegated scopes (should include access_as_user)
        "claims": claims,                   # keep full claims for advanced routes if needed
    }


def require_admin_jwt(user: dict = Depends(require_user_jwt)):
    """
    Admin gate:
      - Primary: App role 'Tenant.Admin'
      - Temporary fallback (optional): legacy group via DOC_TAGGER_ADMIN_GROUP (if present in claims)
    """
    roles = user.get("roles") or []
    if "Tenant.Admin" in roles:
        return user

    legacy_group = os.getenv("DOC_TAGGER_ADMIN_GROUP")
    if legacy_group and legacy_group in (user.get("claims", {}).get("groups") or []):
        return user

    raise HTTPException(status_code=403, detail="Admin role required")
