"""Pydantic models for course and tree payloads."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CourseCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    syllabus: str = Field(..., min_length=1)


class CourseSummary(BaseModel):
    id: str
    title: str
    syllabus: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class TreeNode(BaseModel):
    id: str
    title: str
    type: str
    status: str = "pending"
    parentId: Optional[str] = None
    order: int = 0
    children: List["TreeNode"] = []


class CourseTreeResponse(BaseModel):
    course: CourseSummary
    tree: TreeNode


class CourseWithTreeResponse(BaseModel):
    course: CourseSummary
    tree: TreeNode


TreeNode.model_rebuild()
