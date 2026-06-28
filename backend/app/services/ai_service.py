"""Gemini client and shared AI helpers.

Uses ``langchain-google-genai.ChatGoogleGenerativeAI`` because it accepts the
newer ``AQ.*`` API keys issued by Google AI Studio out of the box (the raw
``google-genai`` SDK rejects them with ``401 ACCESS_TOKEN_TYPE_UNSUPPORTED``).

Exposes two reusable entry points:
    generate_text(prompt) -> str
    generate_json(prompt, schema) -> BaseModel

The JSON helper strips markdown fences, validates via Pydantic, and retries
once with a correction prompt when the first response cannot be parsed.
"""

import json
import re
from typing import Type, TypeVar

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, ValidationError

from app.config import settings

T = TypeVar("T", bound=BaseModel)

_llm: ChatGoogleGenerativeAI | None = None


def get_llm() -> ChatGoogleGenerativeAI:
    """Build (and cache) a singleton Gemini chat model."""
    global _llm
    if _llm is not None:
        return _llm
    if not settings.GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is not configured")
    _llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        temperature=0,
        google_api_key=settings.GOOGLE_API_KEY,
    )
    return _llm


def _strip_fences(text: str) -> str:
    """Remove Markdown code fences and surrounding noise from model output."""
    if not text:
        return text
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    return text


def _extract_text(response) -> str:
    """Best-effort extraction of plain text from a LangChain AIMessage."""
    content = getattr(response, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                text = block.get("text")
                if text:
                    parts.append(text)
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return str(content)


def generate_text(prompt: str) -> str:
    """Call Gemini and return plain text output."""
    llm = get_llm()
    response = llm.invoke([HumanMessage(content=prompt)])
    return _extract_text(response).strip()


def generate_json(
    prompt: str,
    schema: Type[T],
    *,
    max_retries: int = 1,
) -> T:
    """Call Gemini, parse JSON, validate against a Pydantic schema.

    Retries once with a correction prompt when parsing or validation fails.
    """
    last_error: Exception | None = None
    current_prompt = prompt

    for attempt in range(max_retries + 1):
        try:
            raw = generate_text(current_prompt)
            cleaned = _strip_fences(raw)
            data = json.loads(cleaned)
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object at the top level")
            return schema.model_validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc
            if attempt >= max_retries:
                break
            current_prompt = (
                f"{prompt}\n\n"
                "Your previous response was not valid JSON matching the requested schema. "
                f"Error: {exc}\n"
                "Return ONLY a single JSON object that strictly matches the schema. "
                "Do not include any prose, code fences, or commentary."
            )

    raise RuntimeError(f"Gemini returned invalid JSON: {last_error}")


async def store_ai_output(
    db,
    *,
    course_id,
    node_id,
    output_type: str,
    content,
    metadata: dict | None = None,
) -> str:
    """Persist an AI output and return the new document id."""
    from app.utils import utcnow  # local import to avoid cycles

    doc = {
        "courseId": course_id,
        "nodeId": node_id,
        "type": output_type,
        "content": content,
        "metadata": metadata or {},
        "createdAt": utcnow(),
    }
    result = await db.ai_outputs.insert_one(doc)
    return str(result.inserted_id)