# doctagger_backend/main.py
import os
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware


from .routes import feedback, tagging, sharepoint, upload_targets, graph_browser
from .auth_jwt import require_user_jwt, require_admin_jwt



app = FastAPI()

# CORS Middleware (adjust origins for production!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://ambitious-smoke-0aa480803.2.azurestaticapps.net",
        "https://app.doctaggerai.com",  # add when bound
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # includes Authorization
)

# Route mounting
app.include_router(feedback.router)
app.include_router(tagging.router)
app.include_router(sharepoint.router)
app.include_router(upload_targets.router)
app.include_router(graph_browser.router)

# --------------------------------------------------------------------
# Authentication-protected endpoints
# --------------------------------------------------------------------

@app.get("/me-jwt")
def me_jwt(user=Depends(require_user_jwt)):
    """
    Return current user details from their JWT access token.
    """
    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "tid": user.get("tid"),
        "isAdmin": "Tenant.Admin" in (user.get("roles") or []),
        "groups": user.get("claims", {}).get("groups", []),
    }

# Example admin-only health check (optional)
@app.get("/admin/health")
def admin_health(_: dict = Depends(require_admin_jwt)):
    return {"ok": True}

# Debug helper (safe to keep in dev only)
@app.get("/debug/env")
def debug_env():
    return {"API_APP_ID": os.getenv("API_APP_ID")}
