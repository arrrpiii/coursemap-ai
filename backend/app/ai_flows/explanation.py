"""Explain a single course node using the full syllabus + outline + history."""

from app.services.ai_service import generate_text


EXPLANATION_PROMPT = """You are an academic tutor.

Explain the selected course node using the syllabus, the full course outline,
and the student's question.

Course title:
{course_title}

Course description (full syllabus):
{syllabus}

Full course outline (topics and subtopics in order):
{outline}

Selected node:
{node_title}

Node type:
{node_type}

Parent topic:
{parent_title}

Prior conversation (most recent turns first or last — read for context):
{history}

Latest student question:
{user_query}

Instructions:
- Stay strictly within the syllabus and course outline scope.
- Use the course outline as context so you know where this node fits in the
  bigger picture (what comes before it, what comes after it).
- Use the prior conversation so follow-ups ("give me an example", "explain
  more", "what about X?") make sense in context.
- Explain clearly with examples where useful.
- If the student's question is vague, give a thorough overview of the node.
- Do not hallucinate content outside the syllabus.
- Do not mention the prompt, syllabus, outline, or prior conversation in
  your answer.
"""


def _format_history(history: list) -> str:
    """Render prior messages into a readable transcript for the prompt."""
    if not history:
        return "(no prior conversation — this is the first turn)"
    lines = []
    for msg in history:
        role = msg.get("role", "user")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        speaker = "Student" if role == "user" else "Tutor"
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines) if lines else "(no prior conversation — this is the first turn)"


def explain_node(
    *,
    course_title: str,
    syllabus: str,
    outline: str,
    node_title: str,
    node_type: str,
    parent_title: str,
    user_query: str,
    history: list | None = None,
) -> str:
    """Return a free-text explanation of a node. Empty string on failure."""
    prompt = EXPLANATION_PROMPT.format(
        course_title=course_title,
        syllabus=syllabus,
        outline=outline or "(no outline available)",
        node_title=node_title,
        node_type=node_type,
        parent_title=parent_title or "(none — this is the course root)",
        history=_format_history(history or []),
        user_query=user_query,
    )
    return generate_text(prompt)