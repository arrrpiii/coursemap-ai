"""LangGraph flow that generates a full sample question paper."""

from typing import List, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.services.ai_service import generate_json


class PaperQuestion(BaseModel):
    question: str
    marks: int
    answer: str = ""


class PaperSection(BaseModel):
    name: str
    instructions: str
    questions: List[PaperQuestion]


class SamplePaperPayload(BaseModel):
    title: str
    durationMinutes: int
    totalMarks: int
    sections: List[PaperSection]


class FlowState(TypedDict, total=False):
    prompt: str
    payload: dict
    error: str


def prepare_input(state: FlowState) -> FlowState:
    return state


def call_gemini(state: FlowState) -> FlowState:
    try:
        model = generate_json(state.get("prompt", ""), SamplePaperPayload)
        return {**state, "payload": model.model_dump()}
    except Exception as exc:  # noqa: BLE001
        return {**state, "error": str(exc)}


def validate_output(state: FlowState) -> FlowState:
    if not state.get("payload"):
        raise RuntimeError(state.get("error") or "Failed to generate paper")
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


SAMPLE_PAPER_PROMPT = """You are a university exam paper setter.

Generate a full sample question paper for this course.

Course title:
{course_title}

Syllabus:
{syllabus}

Course tree:
{course_tree}

All available notes:
{all_notes}

Total marks:
{total_marks}

Duration in minutes:
{duration_minutes}

Difficulty:
{difficulty}

Include answers:
{include_answers}

Return JSON only in this exact format:
{{
  "title": "string",
  "durationMinutes": 180,
  "totalMarks": 100,
  "sections": [
    {{
      "name": "string",
      "instructions": "string",
      "questions": [
        {{
          "question": "string",
          "marks": 5,
          "answer": "string"
        }}
      ]
    }}
  ]
}}

Rules:
- Cover the full syllabus.
- Balance marks across major topics.
- Use professor notes heavily where available.
- Total marks must equal the requested total marks.
- If includeAnswers is false, use empty strings for answers.
- Do not include markdown.
"""


def run_sample_paper_flow(
    *,
    course_title: str,
    syllabus: str,
    course_tree: str,
    all_notes: str,
    total_marks: int,
    duration_minutes: int,
    difficulty: str,
    include_answers: bool,
) -> dict:
    prompt = SAMPLE_PAPER_PROMPT.format(
        course_title=course_title,
        syllabus=syllabus,
        course_tree=course_tree,
        all_notes=all_notes or "(none)",
        total_marks=total_marks,
        duration_minutes=duration_minutes,
        difficulty=difficulty,
        include_answers=str(include_answers).lower(),
    )
    result = _compiled.invoke({"prompt": prompt})
    return result.get("payload") or {}
