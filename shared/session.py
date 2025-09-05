# session.py
import os
from itsdangerous import URLSafeSerializer
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SESSION_SECRET", "dev-secret")
SESSION_COOKIE = "doctagger_session"

serializer = URLSafeSerializer(SECRET_KEY)

def create_session(data: dict) -> str:
    return serializer.dumps(data)

def verify_session(token: str) -> dict:
    try:
        return serializer.loads(token)
    except Exception:
        return None
