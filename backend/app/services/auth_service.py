from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import bcrypt
import jwt
from bson import ObjectId

from app.config import settings
from app.utils import serialize_doc, utcnow


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Constant-time bcrypt check; returns False on any decode/hash error."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    """Sign a short-lived JWT carrying the user id (sub) and email."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Return the decoded JWT claims. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


async def find_user_by_email(db, email: str) -> Optional[dict]:
    """Look up a user by lowercased email."""
    doc = await db.users.find_one({"email": email.lower().strip()})
    return serialize_doc(doc) if doc else None


async def find_user_by_id(db, user_id: str) -> Optional[dict]:
    """Look up a user by ObjectId."""
    oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
    if oid is None:
        return None
    doc = await db.users.find_one({"_id": oid})
    return serialize_doc(doc) if doc else None


async def create_user(db, email: str, password: str, name: str) -> dict:
    """Insert a new user with a bcrypt-hashed password; return the serialized document."""
    now = utcnow()
    doc = {
        "email": email.lower().strip(),
        "name": name.strip(),
        "passwordHash": hash_password(password),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


async def authenticate_user(
    db, email: str, password: str
) -> Tuple[Optional[dict], Optional[str]]:
    """Return (user_doc, error_message). error_message is non-None on failure."""
    user = await find_user_by_email(db, email)
    if not user:
        return None, "Invalid email or password"
    if not verify_password(password, user.get("passwordHash", "")):
        return None, "Invalid email or password"
    return user, None


DATA_COLLECTIONS = ("courses", "course_nodes", "chat_messages", "ai_outputs", "node_notes")


async def wipe_data_collections_if_first_user(db) -> bool:
    """Drop the data collections on the very first registration. Returns True if a wipe happened."""
    user_count = await db.users.count_documents({})
    if user_count > 0:
        return False
    for name in DATA_COLLECTIONS:
        try:
            await db.drop_collection(name)
        except Exception:
            pass
    return True