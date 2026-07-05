"""LangGraph flow that produces a context-aware explanation for a node.

The prompt includes:
  - the full course description (syllabus)
  - the entire list of topics and subtopics in the course
  - the title of the selected node and its parent topic
  - the student's free-form question
"""

from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.services.ai_service import generate_text


class FlowState(TypedDict, total=False):
    prompt: str
    content: str
    error: str


def prepare_input(state: FlowState) -> FlowState:
    return state


def call_gemini(state: FlowState) -> FlowState:
    text = generate_text(state.get("prompt", ""))
    return {**state, "content": text}


def validate_output(state: FlowState) -> FlowState:
    if not state.get("content"):
        raise RuntimeError(state.get("error") or "No explanation generated")
    return state


def build_graph():
    workflow = StateGraph(FlowState)
    workflow.add_node("prepare_input", prepare_input)
    workflow.add_node("call_gemini", call_gemini)
    workflow.add_node("validate_output", validate_output)
    workflow.set_entry_point("prepare_input")
    workflow.add_edge("prepare_input", "call_gemini")
    workflow.add_edge("call_gemini", "validate_output")
    workflow.add_edge("validate_output", END)
    return workflow.compile()


_compiled = build_graph()


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


def run_explanation_flow(
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
    result = _compiled.invoke({"prompt": prompt})
    return result.get("content", "")