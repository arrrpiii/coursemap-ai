from typing import Any, List, Optional

from app.utils import build_tree, serialize_doc, to_object_id, utcnow


async def create_course(db, title: str, syllabus: str, user_id):
    """Insert a course document and return (raw_id, serialized_dict)."""
    now = utcnow()
    doc = {
        "userId": user_id,
        "title": title.strip(),
        "syllabus": syllabus.strip(),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.courses.insert_one(doc)
    doc["_id"] = result.inserted_id
    return result.inserted_id, serialize_doc(doc)


async def list_courses(db, user_id) -> List[dict]:
    """Return all courses owned by user_id, most recent first."""
    cursor = db.courses.find({"userId": user_id}).sort("createdAt", -1)
    return [serialize_doc(doc) async for doc in cursor]


async def get_course(db, course_id: str, user_id=None) -> Optional[dict]:
    """Fetch a course by id. If user_id is provided, only return if owned by them."""
    oid = to_object_id(course_id)
    if oid is None:
        return None
    query = {"_id": oid}
    if user_id is not None:
        query["userId"] = user_id
    doc = await db.courses.find_one(query)
    return serialize_doc(doc) if doc else None


async def get_course_tree(db, course_id: str, user_id=None) -> Optional[dict]:
    """Return the nested topic/subtopic tree for a course, or None if not found."""
    course = await get_course(db, course_id, user_id)
    if not course:
        return None

    oid = to_object_id(course_id)
    nodes_cursor = db.course_nodes.find({"courseId": oid}).sort("order", 1)
    nodes = [doc async for doc in nodes_cursor]

    root_doc = next((n for n in nodes if n.get("type") == "root"), None)
    if not root_doc:
        return None
    tree = build_tree(nodes, root_doc["_id"])
    return {"course": course, "tree": tree}


async def get_course_outline_text(db, course_id) -> str:
    """Return a flat text outline (1. Topic / 1.1 Subtopic) for AI context."""
    oid = to_object_id(course_id)
    if oid is None:
        return ""
    cursor = db.course_nodes.find({"courseId": oid}).sort("order", 1)
    nodes = [doc async for doc in cursor]
    root = next((n for n in nodes if n.get("type") == "root"), None)
    if not root:
        return ""
    topics = [n for n in nodes if n.get("type") == "topic"]
    lines = []
    for t_index, topic in enumerate(topics, start=1):
        lines.append(f"{t_index}. {topic.get('title', '').strip()}")
        subs = [n for n in nodes if n.get("parentId") == topic["_id"]]
        for s_index, sub in enumerate(subs, start=1):
            lines.append(f"    {t_index}.{s_index} {sub.get('title', '').strip()}")
    return "\n".join(lines)


async def create_root_node(db, course_id, title: str) -> Any:
    """Insert the root course node and return the ObjectId."""
    now = utcnow()
    doc = {
        "courseId": course_id,
        "parentId": None,
        "type": "root",
        "title": title.strip(),
        "order": 0,
        "status": "pending",
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.course_nodes.insert_one(doc)
    return result.inserted_id


async def create_topic_node(db, course_id, parent_id, title: str, order: int) -> Any:
    """Insert a topic node under a parent and return its ObjectId."""
    now = utcnow()
    doc = {
        "courseId": course_id,
        "parentId": parent_id,
        "type": "topic",
        "title": title.strip(),
        "order": order,
        "status": "pending",
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.course_nodes.insert_one(doc)
    return result.inserted_id


async def create_subtopic_node(
    db, course_id, parent_id, title: str, order: int
) -> Any:
    """Insert a subtopic node under a topic and return its ObjectId."""
    now = utcnow()
    doc = {
        "courseId": course_id,
        "parentId": parent_id,
        "type": "subtopic",
        "title": title.strip(),
        "order": order,
        "status": "pending",
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.course_nodes.insert_one(doc)
    return result.inserted_id


async def save_generated_tree(db, course_id, root_id, topics) -> None:
    """Persist a list of {title, subtopics[]} produced by the Gemini course tree flow."""
    for order, topic in enumerate(topics):
        title = (topic.get("title") or "").strip()
        if not title:
            continue
        topic_id = await create_topic_node(db, course_id, root_id, title, order)
        subtopics = topic.get("subtopics") or []
        for sub_order, sub_title in enumerate(subtopics):
            sub_title_clean = (sub_title or "").strip()
            if not sub_title_clean:
                continue
            await create_subtopic_node(
                db, course_id, topic_id, sub_title_clean, sub_order
            )


async def delete_course(db, course_id: str, user_id) -> bool:
    """Cascade-delete a course and all its nodes/chat/AI outputs (owner-only)."""
    oid = to_object_id(course_id)
    if oid is None:
        return False

    course_result = await db.courses.delete_one({"_id": oid, "userId": user_id})
    if course_result.deleted_count == 0:
        return False

    await db.course_nodes.delete_many({"courseId": oid})
    await db.chat_messages.delete_many({"courseId": oid})
    await db.ai_outputs.delete_many({"courseId": oid})
    return True