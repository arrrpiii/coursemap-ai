"""Pydantic models for authentication endpoints.

Kept minimal — no email-validator dependency. We rely on a lightweight
regex check in the route layer for a basic email-shape guard.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(..., min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    createdAt: Optional[datetime] = None


TokenResponse.model_rebuild()