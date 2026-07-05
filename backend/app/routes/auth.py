"""Authentication HTTP routes: register, login, me."""

import re

from fastapi import APIRouter, Depends, Header, HTTPException

import jwt
from app.db import get_db
from app.models.auth_models import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


# Lightweight email-shape check. Good enough to catch typos; not RFC 5322.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email_shape(email: str) -> None:
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email format")


async def get_current_user(
    authorization: str | None = Header(default=None),
    db=Depends(get_db),
):
    """FastAPI dependency: extracts and validates the Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[len("Bearer ") :].strip()
    try:
        claims = auth_service.decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await auth_service.find_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def _user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]) if "_id" in user else user.get("id"),
        email=user.get("email", ""),
        name=user.get("name"),
        createdAt=user.get("createdAt"),
    )


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest):
    email = payload.email.strip().lower()
    _validate_email_shape(email)
    db = get_db()
    existing = await auth_service.find_user_by_email(db, email)
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")

    # First user registration wipes the pre-auth data collections.
    await auth_service.wipe_data_collections_if_first_user(db)

    user = await auth_service.create_user(
        db, email, payload.password, payload.name
    )
    token = auth_service.create_access_token(
        str(user["_id"]) if "_id" in user else user.get("id"),
        user["email"],
    )
    return TokenResponse(access_token=token, user=_user_response(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    db = get_db()
    user, err = await auth_service.authenticate_user(
        db, email, payload.password
    )
    if err or not user:
        raise HTTPException(status_code=401, detail=err or "Invalid credentials")
    token = auth_service.create_access_token(
        str(user["_id"]) if "_id" in user else user.get("id"),
        user["email"],
    )
    return TokenResponse(access_token=token, user=_user_response(user))


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return _user_response(current_user)