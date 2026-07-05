"""Gemini (gemini-2.5-flash) client used by all AI flows.

Calls the Google GenAI SDK directly — no LangGraph, no LangChain. Each
flow module builds its own prompt and calls ``generate_text`` or
``generate_json``; nothing more.

Auth: see ``app.config`` for the two supported modes (public Gemini API
vs. Vertex AI Express). ``_get_client`` picks the right one.

Exposes two reusable entry points:
    generate_text(prompt) -> str
    generate_json(prompt, schema) -> BaseModel

The JSON helper forces ``response_mime_type="application/json"`` so the
model emits parseable JSON, and retries with a correction prompt when
Pydantic validation still fails.
"""

import json
import logging
import os
import re
from typing import Type, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMUnavailable(Exception):
    """Raised when Gemini can't fulfill the request (missing key, network
    error, timeout, safety refusal, malformed response, etc.)."""


# ---------- shared SDK client ----------

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Build (and cache) the Google GenAI client.

    See ``app.config`` for the two supported auth modes.
    """
    global _client
    if _client is not None:
        return _client

    if not settings.GEMINI_API_KEY:
        raise LLMUnavailable(
            "GEMINI_API_KEY is not set. Add it to backend/.env and restart. "
            "If your key starts with 'AQ.', also set GEMINI_USE_VERTEX=true "
            "and GEMINI_PROJECT=<your project number>."
        )

    if settings.GEMINI_USE_VERTEX:
        if not settings.GEMINI_PROJECT:
            raise LLMUnavailable(
                "GEMINI_USE_VERTEX=true but GEMINI_PROJECT is empty. "
                "Set it to the numeric project id from AI Studio "
                "(e.g. 835283834241) in backend/.env and restart."
            )
        # SDK reads the API key from the env, not the constructor,
        # in Vertex mode ("project/location and API key are mutually
        # exclusive in the client initializer").
        os.environ["GOOGLE_API_KEY"] = settings.GEMINI_API_KEY
        _client = genai.Client(
            vertexai=True,
            project=settings.GEMINI_PROJECT,
            location=settings.GEMINI_LOCATION or "global",
        )
    else:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)

    return _client


def _call_gemini_raw(
    prompt: str,
    *,
    response_mime_type: str | None = None,
    temperature: float = 0.0,
    timeout: float = 60.0,
) -> str:
    """Call Gemini and return the model's text.

    Set ``response_mime_type="application/json"`` for structured outputs —
    the SDK then guarantees parseable JSON, which dramatically reduces
    the need for downstream retries. Raises ``LLMUnavailable`` on any
    error the caller can act on.
    """
    try:
        client = _get_client()
        config_kwargs: dict = {"temperature": temperature, "timeout": timeout}
        if response_mime_type:
            config_kwargs["response_mime_type"] = response_mime_type
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(**config_kwargs),
        )
    except LLMUnavailable:
        raise
    except Exception as exc:  # network / SDK / auth / timeout etc.
        msg = str(exc) or exc.__class__.__name__
        raise LLMUnavailable(
            f"Gemini request failed: {msg}. "
            f"Check GEMINI_API_KEY and your network connection."
        ) from exc

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise LLMUnavailable(
            "Gemini returned an empty response. The model may be temporarily "
            "overloaded — try again in a moment."
        )
    return text


# ---------- public helpers ----------

def generate_text(prompt: str) -> str:
    """Call Gemini and return plain text output."""
    return _call_gemini_raw(prompt)


def _preview(text, limit: int = 200) -> str:
    """Single-line, length-capped preview, for logs/errors."""
    if text is None:
        return "<NoneType>"
    one_line = " ".join(text.split())
    if len(one_line) <= limit:
        return one_line
    return one_line[:limit] + "…"


def _strip_fences(text: str) -> str:
    """Remove Markdown code fences and surrounding noise from model output."""
    if not text:
        return text
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    return text


def generate_json(
    prompt: str,
    schema: Type[T],
    *,
    max_retries: int = 2,
) -> T:
    """Call Gemini, parse JSON, validate against a Pydantic schema.

    Forces ``response_mime_type="application/json"`` so the SDK returns
    strict JSON. Retries with a correction prompt if validation still
    fails (model hallucination, schema drift, etc.).
    """
    last_error: Exception | None = None
    last_raw = ""
    current_prompt = prompt

    for attempt in range(max_retries + 1):
        raw = _call_gemini_raw(
            current_prompt,
            response_mime_type="application/json",
        )
        last_raw = raw
        cleaned = _strip_fences(raw)

        try:
            data = json.loads(cleaned)
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object at the top level")
            return schema.model_validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc
            logger.warning(
                "Gemini JSON validate failed (attempt %d/%d): %s | raw=%r",
                attempt + 1,
                max_retries + 1,
                exc,
                _preview(last_raw, 300),
            )
            if attempt >= max_retries:
                break
            correction = (
                f"Your previous response did not match the requested JSON "
                f"schema. Error: {exc}\n"
                "Return ONLY a single JSON object that strictly matches the "
                "schema. Do not include any prose, code fences, or commentary."
            )
            current_prompt = f"{prompt}\n\n{correction}"

    raise LLMUnavailable(
        f"Gemini returned invalid JSON after {max_retries + 1} attempts: "
        f"{last_error}. Raw response: {_preview(last_raw, 200)!r}"
    )


# ---------- persistence ----------

async def store_ai_output(
    db,
    *,
    course_id,
    node_id,
    output_type,
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