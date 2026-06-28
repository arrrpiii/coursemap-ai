"""Per-node chat HTTP routes (history + send + clear). Auth required."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import get_db
from app.langgraph_flows.explanation_flow import run_explanation_flow
from app.routes.auth import get_current_user
from app.services import chat_service, course_service, node_service
from app.utils import to_object_id

router = APIRouter(prefix="/api/courses", tags=["chat"])


class ChatSendRequest(BaseModel):
    message: str = Field(..., min_length=1)


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    createdAt: str | None = None


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessage]


async def _load_context(db, course_id: str, node_id: str, user_id):
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
        "parent_title": parent_title,
        "outline": outline,
    }


@router.get("/{course_id}/nodes/{node_id}/chat", response_model=ChatHistoryResponse)
async def get_chat_history(
    course_id: str,
    node_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]

    # Verify the user owns this course before returning chat history.
    course = await course_service.get_course(db, course_id, user_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_oid = to_object_id(course_id)
    node_oid = to_object_id(node_id)
    if course_oid is None or node_oid is None:
        raise HTTPException(status_code=400, detail="Invalid id")
    messages = await chat_service.get_chat_history(db, course_oid, node_oid)
    return {"messages": messages}


@router.post("/{course_id}/nodes/{node_id}/chat")
async def send_chat_message(
    course_id: str,
    node_id: str,
    payload: ChatSendRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["_id"] if "_id" in current_user else current_user["id"]
    ctx = await _load_context(db, course_id, node_id, user_id)

    user_text = payload.message.strip()

    # Persist the user's turn first so it shows up even if the model call fails.
    await chat_service.add_chat_message(
        db, ctx["course_oid"], ctx["node_oid"], "user", user_text
    )

    # Build history for the prompt (existing transcript including the turn we just added).
    history = await chat_service.get_chat_history(db, ctx["course_oid"], ctx["node_oid"])
    # The "history" param should not include the brand-new user message; the prompt
    # already renders it as the latest question. Strip the last one if it matches.
    prompt_history = list(history)
    if prompt_history and prompt_history[-1].get("role") == "user" and \
       prompt_history[-1].get("content") == user_text and len(prompt_history) > 1:
        prompt_history = prompt_history[:-1]

    try:
        assistant_text = run_explanation_flow(
            course_title=ctx["course"].get("title", ""),
            syllabus=ctx["course"].get("syllabus", ""),
            outline=ctx["outline"],
            node_title=ctx["node"].get("title", ""),
            node_type=ctx["node"].get("type", ""),
            parent_title=ctx["parent_title"],
            user_query=user_text,
            history=prompt_history,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}")

    assistant_msg = await chat_service.add_chat_message(
        db, ctx["course_oid"], ctx["node_oid"], "assistant", assistant_text
    )

    return {"message": assistant_msg}


@router.delete("/{course_id}/nodes/{node_id}/chat")
async def clear_chat(
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
    deleted = await chat_service.clear_chat_history(db, course_oid, node_oid)
    return {"deleted": deleted}