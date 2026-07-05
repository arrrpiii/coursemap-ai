"""Shared utility helpers for serializing documents and building trees."""

from datetime import datetime, timezone
from typing import Any, Iterable

from bson import ObjectId


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_object_id(value: str | ObjectId | None) -> ObjectId | None:
    """Convert a string id to ObjectId when possible, otherwise return None."""
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return value
    if not value:
        return None
    try:
        return ObjectId(value)
    except Exception:
        return None


def serialize(value: Any) -> Any:
    """Recursively convert ObjectId and datetime values to JSON-friendly types."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: serialize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [serialize(v) for v in value]
    return value


def serialize_doc(doc: dict | None) -> dict | None:
    """Serialize a Mongo document and expose `_id` as `id` for clients."""
    if doc is None:
        return None
    out = serialize(doc)
    if isinstance(out, dict) and "_id" in out and "id" not in out:
        out["id"] = out["_id"]
    return out


def build_tree(nodes: Iterable[dict], root_id: ObjectId) -> dict | None:
    """Build a nested tree from a flat list of course_nodes documents.

    Each node is expected to have: _id, parentId, title, type, status, order.
    """
    nodes_list = list(nodes)
    by_parent: dict[str | None, list[dict]] = {}
    for node in nodes_list:
        parent_key = str(node.get("parentId")) if node.get("parentId") else None
        by_parent.setdefault(parent_key, []).append(node)

    for key in by_parent:
        by_parent[key].sort(key=lambda n: n.get("order", 0))

    def attach(parent_id: ObjectId | None) -> list[dict]:
        key = str(parent_id) if parent_id else None
        children: list[dict] = []
        for child in by_parent.get(key, []):
            children.append(
                {
                    "id": str(child["_id"]),
                    "title": child["title"],
                    "type": child["type"],
                    "status": child.get("status", "pending"),
                    "parentId": str(child["parentId"]) if child.get("parentId") else None,
                    "order": child.get("order", 0),
                    "children": attach(child["_id"]),
                }
            )
        return children

    for node in nodes_list:
        if node.get("_id") == root_id:
            return {
                "id": str(node["_id"]),
                "title": node["title"],
                "type": node["type"],
                "status": node.get("status", "pending"),
                "parentId": None,
                "order": node.get("order", 0),
                "children": attach(node["_id"]),
            }
    return None
