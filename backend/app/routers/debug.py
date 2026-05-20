import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import get_supported_model_ids
from ..database import get_db
from ..models import User
from ..services.auth_service import get_current_user
from ..services.llm_service import _build_model_controls, _normalize_reasoning_level

from openai import AsyncOpenAI
from ..config import settings

router = APIRouter(prefix="/api/debug", tags=["debug"])

_client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL,
)


class DebugChatMessage(BaseModel):
    role: str
    content: str


class DebugChatRequest(BaseModel):
    model: str
    messages: list[DebugChatMessage]
    max_tokens: int = 128
    stream: bool = True
    stream_options: dict = {"include_usage": True}
    thinking: dict | None = None


@router.post("/chat")
async def debug_chat(
    body: DebugChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Debug endpoint for Chat Completions API - returns raw streaming response."""

    if body.model not in get_supported_model_ids():
        raise HTTPException(status_code=400, detail=f"Model `{body.model}` is not supported")

    if not body.messages:
        raise HTTPException(status_code=400, detail="Messages array is required")

    # Build messages for API call (no system prompt injection for debug)
    api_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in body.messages
        if msg.content.strip()
    ]

    if not api_messages:
        raise HTTPException(status_code=400, detail="At least one non-empty message is required")

    # Determine reasoning level from thinking param
    reasoning_level = "off"
    if body.thinking and body.thinking.get("type") == "enabled":
        reasoning_level = "standard"

    extra_body, model_max_tokens = _build_model_controls(body.model, reasoning_level)
    requested_max_tokens = max(1, min(body.max_tokens, model_max_tokens))

    if body.stream:
        async def event_stream():
            stream_cancelled = False
            accumulated_usage = None

            try:
                stream = await _client.chat.completions.create(
                    model=body.model,
                    messages=api_messages,
                    stream=True,
                    stream_options=body.stream_options if body.stream_options.get("include_usage") else None,
                    max_tokens=requested_max_tokens,
                    extra_body=extra_body or None,
                )

                async for chunk in stream:
                    choices = getattr(chunk, "choices", None) or []
                    if choices:
                        delta = getattr(choices[0], "delta", None)
                        content = getattr(delta, "content", None)
                        if content:
                            yield f"data: {json.dumps({'choices': [{'delta': {'content': content}}]})}\n\n"

                    # Capture usage from stream
                    usage = getattr(chunk, "usage", None)
                    if usage:
                        accumulated_usage = {
                            "prompt_tokens": usage.prompt_tokens,
                            "completion_tokens": usage.completion_tokens,
                            "total_tokens": usage.total_tokens,
                        }

                # Send final usage if available
                if accumulated_usage:
                    yield f"data: {json.dumps({'usage': accumulated_usage})}\n\n"

            except asyncio.CancelledError:
                stream_cancelled = True
                raise
            except Exception as error:
                yield f"data: {json.dumps({'error': str(error)})}\n\n"

            if not stream_cancelled:
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        # Non-streaming response
        try:
            response = await _client.chat.completions.create(
                model=body.model,
                messages=api_messages,
                stream=False,
                max_tokens=requested_max_tokens,
                extra_body=extra_body or None,
            )

            choices = getattr(response, "choices", None) or []
            message = getattr(choices[0], "message", None) if choices else None
            content = getattr(message, "content", None) or ""
            usage = getattr(response, "usage", None)

            result = {
                "choices": [{"message": {"role": "assistant", "content": content}}],
                "usage": {
                    "prompt_tokens": usage.prompt_tokens if usage else None,
                    "completion_tokens": usage.completion_tokens if usage else None,
                    "total_tokens": usage.total_tokens if usage else None,
                } if usage else None,
            }

            return result
        except Exception as error:
            raise HTTPException(status_code=500, detail=str(error))