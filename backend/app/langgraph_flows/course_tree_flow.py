"""LangGraph flow for generating a course tree from title + syllabus."""

from typing import List, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.services.ai_service import generate_json, generate_text


class SubtopicItem(BaseModel):
    title: str
    subtopics: List[str] = Field(default_factory=list)


class CourseTreePayload(BaseModel):
    courseTitle: str
    topics: List[SubtopicItem]


class FlowState(TypedDict, total=False):
    course_title: str
    syllabus: str
    raw_text: str
    payload: dict
    error: str


COURSE_TREE_PROMPT = """You are an academic course planner.

Convert the given course title and syllabus into a clean course tree.

Course title:
{course_title}

Syllabus:
{syllabus}

Return JSON only in this exact format:
{{
  "courseTitle": "string",
  "topics": [
    {{
      "title": "string",
      "subtopics": ["string"]
    }}
  ]
}}

Rules:
- The root is the course title.
- Generate only topics and subtopics.
- Do not create deeper nesting.
- Do not write explanations.
- Subtopics should be headings only.
- Keep titles concise and academic.
- Merge duplicate or overlapping topics.
- Do not invent unrelated topics.
- Do not include markdown.
"""


def prepare_input(state: FlowState) -> FlowState:
    return state


def call_gemini(state: FlowState) -> FlowState:
    prompt = COURSE_TREE_PROMPT.format(
        course_title=state.get("course_title", ""),
        syllabus=state.get("syllabus", ""),
    )
    try:
        model = generate_json(prompt, CourseTreePayload)
        return {**state, "payload": model.model_dump()}
    except Exception as exc:
        return {**state, "raw_text": generate_text(prompt), "error": str(exc)}


def validate_output(state: FlowState) -> FlowState:
    if state.get("payload"):
        return state
    raw = state.get("raw_text", "")
    if not raw:
        raise RuntimeError(state.get("error") or "Empty response from Gemini")
    # Attempt to parse raw text once more for robustness
    import json
    import re

    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    try:
        data = json.loads(cleaned)
        model = CourseTreePayload.model_validate(data)
        return {**state, "payload": model.model_dump()}
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Failed to validate course tree: {exc}") from exc


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


def run_course_tree_flow(course_title: str, syllabus: str) -> dict:
    initial: FlowState = {
        "course_title": course_title,
        "syllabus": syllabus,
    }
    result = _compiled.invoke(initial)
    return result.get("payload") or {}
