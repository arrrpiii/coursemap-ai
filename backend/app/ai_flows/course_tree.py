from typing import List

from pydantic import BaseModel, Field

from app.services.ai_service import generate_json


class SubtopicItem(BaseModel):
    title: str
    subtopics: List[str] = Field(default_factory=list)


class CourseTreePayload(BaseModel):
    courseTitle: str
    topics: List[SubtopicItem]


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


def generate_course_tree(course_title: str, syllabus: str) -> dict:
    """Ask Gemini to turn a title + syllabus into a 3-level topic tree; return the validated payload as a dict."""
    prompt = COURSE_TREE_PROMPT.format(
        course_title=course_title,
        syllabus=syllabus,
    )
    model = generate_json(prompt, CourseTreePayload)
    return model.model_dump()