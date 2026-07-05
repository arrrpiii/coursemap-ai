"""Node workspace and status HTTP routes (auth required)."""

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.models.node_models import (
    VALID_STATUSES,
    NodeStatusUpdate,
)
from app.routes.auth import get_current_user
from app.services import course_service, node_service
from app.utils import to_object_id

router = APIRouter(prefix="/api/courses", tags=["nodes"])


@router.get("/{course_id}/nodes/{node_id}")
async def get_node_workspace(
    course_id: str,
    node_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]

    course = await course_service.get_course(db, course_id, user_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_oid = to_object_id(course_id)
    node_oid = to_object_id(node_id)
    if course_oid is None or node_oid is None:
        raise HTTPException(status_code=400, detail="Invalid id")

    node = await node_service.get_node(db, course_id, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    parent = None
    if node.get("parentId"):
        parent = await node_service.get_parent_node(db, node["parentId"])

    recent = await node_service.get_recent_outputs(db, course_oid, node_oid)

    return {
        "course": course,
        "node": node,
        "parent": parent,
        "recentOutputs": recent,
    }


@router.patch("/{course_id}/nodes/{node_id}/status")
async def update_status(
    course_id: str,
    node_id: str,
    payload: NodeStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {sorted(VALID_STATUSES)}",
        )

    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]

    course = await course_service.get_course(db, course_id, user_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_oid = to_object_id(course_id)
    node_oid = to_object_id(node_id)
    if course_oid is None or node_oid is None:
        raise HTTPException(status_code=400, detail="Invalid id")

    node = await node_service.update_node_status(
        db, course_oid, node_oid, payload.status
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return {
        "id": str(node["_id"]) if "_id" in node else node.get("id"),
        "status": node.get("status"),
    }