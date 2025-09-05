# doctagger_backend/routes/feedback.py
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime
import os, io, csv
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError

# ✅ Switch to JWT-based auth
from ..auth_jwt import require_user_jwt, require_admin_jwt

router = APIRouter()

class Feedback(BaseModel):
    filename: str
    rating: int
    comment: str

# --------------------------------------------------------------------
# Normal users can log feedback
# --------------------------------------------------------------------
@router.post("/feedback")
async def log_feedback(feedback: Feedback, request: Request, user=Depends(require_user_jwt)):
    connection_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container_name = "feedback"
    blob_name = "feedback_log.csv"

    if not connection_str:
        raise HTTPException(500, detail="Missing Azure connection string")

    blob_service = BlobServiceClient.from_connection_string(connection_str)
    container = blob_service.get_container_client(container_name)
    blob_client = container.get_blob_client(blob_name)

    try:
        blob_data = blob_client.download_blob().readall().decode("utf-8")
        rows = list(csv.reader(io.StringIO(blob_data)))
    except:
        rows = [["timestamp", "user", "filename", "rating", "comment"]]

    new_row = [
        datetime.utcnow().isoformat(),
        user.get("email") or user.get("name") or "unknown",
        feedback.filename,
        feedback.rating,
        feedback.comment,
    ]
    rows.append(new_row)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(rows)
    blob_client.upload_blob(output.getvalue(), overwrite=True)

    return {"status": "ok"}

# --------------------------------------------------------------------
# Admins only can list all feedback
# --------------------------------------------------------------------
@router.get("/admin/feedback")
async def get_feedback(user=Depends(require_admin_jwt)):
    connection_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container_name = "feedback"
    blob_name = "feedback_log.csv"

    if not connection_str:
        raise HTTPException(500, detail="Missing Azure connection string")

    blob_service = BlobServiceClient.from_connection_string(connection_str)
    container = blob_service.get_container_client(container_name)
    blob_client = container.get_blob_client(blob_name)

    try:
        blob_data = blob_client.download_blob().readall().decode("utf-8")
        reader = csv.DictReader(io.StringIO(blob_data))
        return list(reader)
    except ResourceNotFoundError:
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load feedback: {str(e)}")
