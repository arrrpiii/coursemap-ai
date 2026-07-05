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
import logging
import re
from typing import Type, TypeVar

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)

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
        # Bump internal retries on transient transport errors so a brief
        # network blip doesn't surface as a hard failure.
        max_retries=3,
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


def _preview(text, limit: int = 200) -> str:
    """Single-line, length-capped preview of a model response, for logs/errors."""
    if text is None:
        return "<NoneType>"
    one_line = " ".join(text.split())
    if len(one_line) <= limit:
        return one_line
    return one_line[:limit] + "…"


def generate_json(
    prompt: str,
    schema: Type[T],
    *,
    max_retries: int = 2,
) -> T:
    """Call Gemini, parse JSON, validate against a Pydantic schema.

    Retries with a correction prompt when parsing or validation fails. If
    the model returns an empty response, the retry prompt explicitly asks
    for a non-empty JSON payload (Gemini occasionally returns blank for
    very long structured outputs).
    """
    last_error: Exception | None = None
    last_raw = ""
    last_cleaned = ""
    current_prompt = prompt

    for attempt in range(max_retries + 1):
        try:
            raw = generate_text(current_prompt)
            last_raw = raw
            cleaned = _strip_fences(raw)
            last_cleaned = cleaned

            if not cleaned:
                # Empty after stripping — most often a safety refusal or
                # a truncated long output. Treat like a parse error so
                # we get a retry with a stronger nudge.
                raise ValueError("Empty response after stripping fences")

            data = json.loads(cleaned)
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object at the top level")
            return schema.model_validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc
            logger.warning(
                "Gemini JSON parse failed (attempt %d/%d): %s | raw=%r | cleaned=%r",
                attempt + 1,
                max_retries + 1,
                exc,
                _preview(last_raw, 300),
                _preview(last_cleaned, 300),
            )
            if attempt >= max_retries:
                break

            if not last_cleaned:
                correction = (
                    "Your previous response was EMPTY. Return a complete, "
                    "non-empty JSON object that strictly matches the schema. "
                    "Do not include any prose, code fences, or commentary."
                )
            else:
                correction = (
                    f"Your previous response was not valid JSON matching the "
                    f"requested schema. Error: {exc}\n"
                    "Return ONLY a single JSON object that strictly matches "
                    "the schema. Do not include any prose, code fences, or "
                    "commentary."
                )
            current_prompt = f"{prompt}\n\n{correction}"

    raise RuntimeError(
        f"Gemini returned invalid JSON after {max_retries + 1} attempts: "
        f"{last_error}. Raw response: {_preview(last_raw, 200)!r}"
    )


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