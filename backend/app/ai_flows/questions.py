from typing import List

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


def generate_questions(
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
    """Ask Gemini for a list of exam questions for a node; return {questions: [...]} validated against QuestionsPayload."""
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
    model = generate_json(prompt, QuestionsPayload)
    return model.model_dump()