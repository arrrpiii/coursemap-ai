"""Per-node chat history persistence."""

from typing import List, Optional

from app.utils import serialize_doc, utcnow


async def get_chat_history(
    db,
    course_id,
    node_id,
    limit: int = 200,
) -> List[dict]:
    """Return the conversation thread for a (courseId, nodeId) in chronological order."""
    cursor = (
        db.chat_messages.find({"courseId": course_id, "nodeId": node_id})
        .sort("createdAt", 1)
        .limit(limit)
    )
    return [serialize_doc(d) async for d in cursor]


async def add_chat_message(
    db,
    course_id,
    node_id,
    role: str,
    content: str,
) -> dict:
    """Insert a single message and return the serialized document."""
    now = utcnow()
    doc = {
        "courseId": course_id,
        "nodeId": node_id,
        "role": role,
        "content": content,
        "createdAt": now,
    }
    result = await db.chat_messages.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


async def clear_chat_history(db, course_id, node_id) -> int:
    """Delete every message in the thread. Returns the number deleted."""
    result = await db.chat_messages.delete_many(
        {"courseId": course_id, "nodeId": node_id}
    )
    return result.deleted_count