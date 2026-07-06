from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.ai_flows.course_tree import generate_course_tree
from app.models.course_models import CourseCreateRequest
from app.routes.auth import get_current_user
from app.services import course_service

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.post("", response_model=None)
async def create_course(
    payload: CourseCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a course, generate its 3-level topic tree via Gemini, return the full tree."""
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    course_oid, _course_doc = await course_service.create_course(
        db, payload.title, payload.syllabus, user_id
    )
    root_id = await course_service.create_root_node(db, course_oid, payload.title)

    try:
        tree_payload = generate_course_tree(payload.title, payload.syllabus)
        topics = tree_payload.get("topics", []) if tree_payload else []
        await course_service.save_generated_tree(db, course_oid, root_id, topics)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Course created but tree generation failed: {exc}",
        )

    result = await course_service.get_course_tree(db, str(course_oid), user_id)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to load created course")
    return result


@router.get("")
async def list_courses(current_user: dict = Depends(get_current_user)):
    """List all courses owned by the authenticated user."""
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    return await course_service.list_courses(db, user_id)


@router.get("/{course_id}/tree")
async def get_course_tree(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return the nested topic/subtopic tree for a course."""
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    result = await course_service.get_course_tree(db, course_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Course not found")
    return result


@router.delete("/{course_id}", status_code=200)
async def delete_course(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a course and all its nodes, chat, and AI outputs."""
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    deleted = await course_service.delete_course(db, course_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"deleted": True, "id": course_id}