"""Authentication service: password hashing, JWT signing, user CRUD."""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import bcrypt
import jwt
from bson import ObjectId

from app.config import settings
from app.utils import serialize_doc, utcnow


# ---------- Password helpers ----------

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------- JWT helpers ----------

def create_access_token(user_id: str, email: str) -> str:
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


# ---------- User CRUD ----------

async def find_user_by_email(db, email: str) -> Optional[dict]:
    doc = await db.users.find_one({"email": email.lower().strip()})
    return serialize_doc(doc) if doc else None


async def find_user_by_id(db, user_id: str) -> Optional[dict]:
    oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
    if oid is None:
        return None
    doc = await db.users.find_one({"_id": oid})
    return serialize_doc(doc) if doc else None


async def create_user(db, email: str, password: str, name: str) -> dict:
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


# ---------- First-user data wipe ----------

DATA_COLLECTIONS = ("courses", "course_nodes", "chat_messages", "ai_outputs", "node_notes")


async def wipe_data_collections_if_first_user(db) -> bool:
    """Drop the data collections on the very first registration.

    Returns True if a wipe happened.
    """
    user_count = await db.users.count_documents({})
    if user_count > 0:
        return False
    for name in DATA_COLLECTIONS:
        try:
            await db.drop_collection(name)
        except Exception:
            # Collection may not exist yet — that's fine
            pass
    return True