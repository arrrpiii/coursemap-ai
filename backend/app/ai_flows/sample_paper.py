from typing import List

from pydantic import BaseModel

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


def generate_sample_paper(
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
    """Ask Gemini for a full-course sample paper; return the validated payload (title, duration, marks, sections)."""
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
    model = generate_json(prompt, SamplePaperPayload)
    return model.model_dump()