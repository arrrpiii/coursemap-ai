"""Pydantic models for node operations."""

from typing import Optional

from pydantic import BaseModel, Field


VALID_STATUSES = {"pending", "learning", "completed"}


class NodeStatusUpdate(BaseModel):
    status: str = Field(..., description="One of pending, learning, completed")


class NodeStatusResponse(BaseModel):
    id: str
    status: str


class NodeSummary(BaseModel):
    id: str
    title: str
    type: str
    status: str
    parentId: Optional[str] = None


class NodeWorkspaceResponse(BaseModel):
    course: dict
    node: dict
    parent: Optional[dict] = None
    recentOutputs: list = []