"""AI generation routes: explain, questions, sample paper. Auth required."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.langgraph_flows.explanation_flow import run_explanation_flow
from app.langgraph_flows.questions_flow import run_questions_flow
from app.langgraph_flows.sample_paper_flow import run_sample_paper_flow
from app.models.ai_models import (
    VALID_DIFFICULTIES,
    VALID_QUESTION_TYPES,
    ExplainRequest,
    QuestionsRequest,
    SamplePaperRequest,
)
from app.routes.auth import get_current_user
from app.services import ai_service, course_service, node_service
from app.utils import to_object_id

router = APIRouter(prefix="/api/courses", tags=["ai"])


async def _load_node_context(db, course_id: str, node_id: str, user_id):
    """Load everything needed to make a context-aware AI request for a node."""
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
    parent_title = ""
    if node.get("parentId"):
        parent = await node_service.get_parent_node(db, node["parentId"])
        if parent:
            parent_title = parent.get("title", "")

    outline = await course_service.get_course_outline_text(db, course_oid)

    return {
        "course": course,
        "course_oid": course_oid,
        "node_oid": node_oid,
        "node": node,
        "parent": parent,
        "parent_title": parent_title,
        "outline": outline,
    }


@router.post("/{course_id}/nodes/{node_id}/explain")
async def explain_node(
    course_id: str,
    node_id: str,
    payload: ExplainRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    ctx = await _load_node_context(db, course_id, node_id, user_id)

    try:
        content = run_explanation_flow(
            course_title=ctx["course"].get("title", ""),
            syllabus=ctx["course"].get("syllabus", ""),
            outline=ctx["outline"],
            node_title=ctx["node"].get("title", ""),
            node_type=ctx["node"].get("type", ""),
            parent_title=ctx["parent_title"],
            user_query=payload.userQuery,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Explanation failed: {exc}")

    await ai_service.store_ai_output(
        db,
        course_id=ctx["course_oid"],
        node_id=ctx["node_oid"],
        output_type="explanation",
        content=content,
        metadata={"userQuery": payload.userQuery},
    )

    return {"type": "explanation", "content": content}


@router.post("/{course_id}/nodes/{node_id}/questions")
async def generate_questions(
    course_id: str,
    node_id: str,
    payload: QuestionsRequest,
    current_user: dict = Depends(get_current_user),
):
    if payload.difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid difficulty. Must be one of: {sorted(VALID_DIFFICULTIES)}",
        )
    bad_types = [t for t in payload.questionTypes if t not in VALID_QUESTION_TYPES]
    if bad_types:
        raise HTTPException(status_code=400, detail=f"Invalid question types: {bad_types}")
    if not payload.questionTypes:
        raise HTTPException(status_code=400, detail="At least one question type is required")

    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    ctx = await _load_node_context(db, course_id, node_id, user_id)

    try:
        result = run_questions_flow(
            course_title=ctx["course"].get("title", ""),
            syllabus=ctx["course"].get("syllabus", ""),
            outline=ctx["outline"],
            node_title=ctx["node"].get("title", ""),
            node_type=ctx["node"].get("type", ""),
            parent_title=ctx["parent_title"],
            difficulty=payload.difficulty,
            count=payload.count,
            question_types=payload.questionTypes,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Question generation failed: {exc}")

    questions = result.get("questions", [])

    await ai_service.store_ai_output(
        db,
        course_id=ctx["course_oid"],
        node_id=ctx["node_oid"],
        output_type="questions",
        content={"questions": questions},
        metadata={
            "difficulty": payload.difficulty,
            "count": payload.count,
            "questionTypes": payload.questionTypes,
        },
    )

    return {"type": "questions", "questions": questions}


@router.post("/{course_id}/sample-paper")
async def generate_sample_paper(
    course_id: str,
    payload: SamplePaperRequest,
    current_user: dict = Depends(get_current_user),
):
    if payload.difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid difficulty. Must be one of: {sorted(VALID_DIFFICULTIES)}",
        )

    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    course = await course_service.get_course(db, course_id, user_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_oid = to_object_id(course_id)
    tree = await course_service.get_course_tree(db, course_id, user_id)
    outline = await course_service.get_course_outline_text(db, course_oid)

    try:
        result = run_sample_paper_flow(
            course_title=course.get("title", ""),
            syllabus=course.get("syllabus", ""),
            course_tree=outline or "(no tree available)",
            all_notes="(no notes — notes feature removed)",
            total_marks=payload.totalMarks,
            duration_minutes=payload.durationMinutes,
            difficulty=payload.difficulty,
            include_answers=payload.includeAnswers,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Sample paper generation failed: {exc}")

    if not payload.includeAnswers:
        for section in result.get("sections", []):
            for q in section.get("questions", []):
                q["answer"] = ""

    await ai_service.store_ai_output(
        db,
        course_id=course_oid,
        node_id=None,
        output_type="sample_paper",
        content=result,
        metadata={
            "totalMarks": payload.totalMarks,
            "durationMinutes": payload.durationMinutes,
            "difficulty": payload.difficulty,
            "includeAnswers": payload.includeAnswers,
        },
    )

    return {"type": "sample_paper", **result}