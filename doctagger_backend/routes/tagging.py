# doctagger_backend/routes/tagging.py
from fastapi import APIRouter, File, UploadFile, Form, Depends, HTTPException
from ..auth_jwt import require_user_jwt  # ✅ JWT-based user gate
from doc_tagger_daemon.shared.tagging_utils import extract_text, get_tags, parse_tags

router = APIRouter()

@router.post("/tag")
async def tag_document(
    file: UploadFile = File(...),
    mode: str = Form("Keywords"),
    custom_prompt: str = Form(""),
    num_tags: int = Form(10),
    user: dict = Depends(require_user_jwt),
):
    # Extract text from the uploaded file
    text = extract_text(file)

    if len(text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Document too short to tag")

    # Call your tagger with the (optionally truncated) text
    raw = get_tags(text[:3000], custom_prompt, num_tags, mode)
    tags = parse_tags(raw)

    return {"tags": tags}
