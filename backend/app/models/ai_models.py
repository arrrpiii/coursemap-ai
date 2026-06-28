"""Pydantic models for AI request and response payloads."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


VALID_DIFFICULTIES = {"easy", "medium", "hard", "mixed"}
VALID_QUESTION_TYPES = {"mcq", "short_answer", "long_answer", "numerical", "case_study"}


class ExplainRequest(BaseModel):
    userQuery: str = Field(..., min_length=1)


class ExplainResponse(BaseModel):
    type: Literal["explanation"] = "explanation"
    content: str


class QuestionsRequest(BaseModel):
    difficulty: str = "medium"
    count: int = Field(10, ge=1, le=50)
    questionTypes: List[str] = Field(default_factory=lambda: ["short_answer"])


class QuestionItem(BaseModel):
    question: str
    type: str
    difficulty: str
    options: List[str] = []
    answer: str


class QuestionsResponse(BaseModel):
    type: Literal["questions"] = "questions"
    questions: List[QuestionItem]


class SamplePaperRequest(BaseModel):
    totalMarks: int = Field(100, ge=10, le=500)
    durationMinutes: int = Field(180, ge=30, le=600)
    difficulty: str = "mixed"
    includeAnswers: bool = True


class SamplePaperQuestion(BaseModel):
    question: str
    marks: int
    answer: str = ""


class SamplePaperSection(BaseModel):
    name: str
    instructions: str
    questions: List[SamplePaperQuestion]


class SamplePaperResponse(BaseModel):
    type: Literal["sample_paper"] = "sample_paper"
    title: str
    durationMinutes: int
    totalMarks: int
    sections: List[SamplePaperSection]