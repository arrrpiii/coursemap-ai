"""LangGraph flow that generates questions for a node."""

from typing import List, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.services.ai_service import generate_json


class QuestionItem(BaseModel):
    question: str
    type: str
    difficulty: str
    options: List[str] = Field(default_factory=list)
    answer: str


class QuestionsPayload(BaseModel):
    questions: List[QuestionItem]


class FlowState(TypedDict, total=False):
    prompt: str
    payload: dict
    error: str


def prepare_input(state: FlowState) -> FlowState:
    return state


def call_gemini(state: FlowState) -> FlowState:
    try:
        model = generate_json(state.get("prompt", ""), QuestionsPayload)
        return {**state, "payload": model.model_dump()}
    except Exception as exc:  # noqa: BLE001
        return {**state, "error": str(exc)}


def validate_output(state: FlowState) -> FlowState:
    if not state.get("payload"):
        raise RuntimeError(state.get("error") or "Failed to generate questions")
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


QUESTIONS_PROMPT = """You are an exam question generator.

Generate questions for the selected course node.

Course title:
{course_title}

Syllabus:
{syllabus}

Selected node:
{node_title}

Node type:
{node_type}

Parent topic:
{parent_title}

Full course outline (topics and subtopics in order):
{outline}

Difficulty:
{difficulty}

Question count:
{count}

Question types:
{question_types}

Return JSON only in this exact format:
{{
  "questions": [
    {{
      "question": "string",
      "type": "mcq | short_answer | long_answer | numerical | case_study",
      "difficulty": "easy | medium | hard",
      "options": ["string"],
      "answer": "string"
    }}
  ]
}}

Rules:
- Use the selected node as the main scope.
- Use the course outline as context so questions stay within the syllabus.
- For MCQ questions, provide exactly 4 options.
- For non-MCQ questions, options must be [].
- Every question must include an answer.
- Do not include markdown.
"""


def run_questions_flow(
    *,
    course_title: str,
    syllabus: str,
    outline: str,
    node_title: str,
    node_type: str,
    parent_title: str,
    difficulty: str,
    count: int,
    question_types: List[str],
) -> dict:
    prompt = QUESTIONS_PROMPT.format(
        course_title=course_title,
        syllabus=syllabus,
        outline=outline or "(no outline available)",
        node_title=node_title,
        node_type=node_type,
        parent_title=parent_title or "(none)",
        difficulty=difficulty,
        count=count,
        question_types=", ".join(question_types),
    )
    result = _compiled.invoke({"prompt": prompt})
    return result.get("payload") or {"questions": []}
