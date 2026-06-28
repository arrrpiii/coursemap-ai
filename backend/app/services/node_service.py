"""Node persistence helpers (notes removed)."""

from typing import Optional

from app.utils import serialize_doc, to_object_id, utcnow


async def get_node(db, course_id: str, node_id: str) -> Optional[dict]:
    course_oid = to_object_id(course_id)
    node_oid = to_object_id(node_id)
    if course_oid is None or node_oid is None:
        return None
    doc = await db.course_nodes.find_one(
        {"_id": node_oid, "courseId": course_oid}
    )
    return serialize_doc(doc) if doc else None


async def get_parent_node(db, parent_id: str) -> Optional[dict]:
    oid = to_object_id(parent_id)
    if oid is None:
        return None
    doc = await db.course_nodes.find_one({"_id": oid})
    return serialize_doc(doc) if doc else None


async def get_recent_outputs(db, course_id, node_id, limit: int = 20) -> list:
    """Return recent AI outputs (explanations / questions) for this node."""
    cursor = (
        db.ai_outputs.find({"courseId": course_id, "nodeId": node_id})
        .sort("createdAt", -1)
        .limit(limit)
    )
    return [serialize_doc(d) async for d in cursor]


async def update_node_status(db, course_id, node_id, status: str) -> Optional[dict]:
    result = await db.course_nodes.find_one_and_update(
        {"_id": node_id, "courseId": course_id},
        {"$set": {"status": status, "updatedAt": utcnow()}},
        return_document=True,
    )
    return serialize_doc(result) if result else None