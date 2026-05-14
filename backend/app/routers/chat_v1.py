import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..config import get_default_model, get_supported_model_ids
from ..database import SessionLocal, get_db
from ..models import Conversation, Memory, User
from ..schemas import (
    ChatAutoRequest,
    ChatMemoryInfo,
    ChatSimpleRequest,
    ChatV1Request,
)
from ..services import llm_service, memory_service
from ..services.auth_service import get_current_user
from ..services.project_service import get_user_project
from ..config import settings

router = APIRouter(prefix="/api/v1", tags=["chat-v1"])


def _get_user_conversation(db: Session, user_id: str, conversation_id: str) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def _get_memories_for_scope(
    db: Session,
    user_id: str,
    scope: str,
    limit: int | None,
    project_id: str | None = None,
    conversation_id: str | None = None,
    query_context: str | None = None,
) -> list[Memory]:
    """Get memories based on scope configuration.

    When query_context is provided and vector search is available,
    uses semantic similarity search instead of time-based ordering.
    """
    if scope == "simple" or scope == "none":
        return []

    actual_limit = limit or settings.VECTOR_SEARCH_TOP_K
    if scope == "all":
        return memory_service.get_enabled_memories_for_context(
            db,
            user_id,
            project_id=project_id,
            conversation_id=conversation_id,
            query_context=query_context,
        )[:actual_limit]

    # Scope-specific memories - use memory_service for semantic search support
    from ..services import vector_search_service

    if query_context and vector_search_service.is_vector_search_available(db):
        try:
            memories = vector_search_service.search_memories_by_text(
                db,
                query_context,
                user_id,
                scope=scope,
                project_id=project_id if scope == "project" else None,
                conversation_id=conversation_id if scope == "conversation" else None,
                top_k=actual_limit,
            )
            if memories or not settings.EMBEDDING_FALLBACK_TO_TIME_SORT:
                return memories
        except Exception:
            if not settings.EMBEDDING_FALLBACK_TO_TIME_SORT:
                return []

    # Fallback: time-based sorting
    if scope == "global":
        stmt = (
            SessionLocal().query(Memory)
            .where(Memory.user_id == user_id)
            .where(Memory.enabled.is_(True))
            .where(Memory.status == "active")
            .where(Memory.scope == "global")
            .where(Memory.archived_at.is_(None))
            .order_by(Memory.last_used_at.desc().nullslast(), Memory.updated_at.desc())
            .limit(actual_limit)
        )
        return list(stmt.all())
    if scope == "project" and project_id:
        stmt = (
            SessionLocal().query(Memory)
            .where(Memory.user_id == user_id)
            .where(Memory.enabled.is_(True))
            .where(Memory.status == "active")
            .where(Memory.scope == "project")
            .where(Memory.project_id == project_id)
            .where(Memory.archived_at.is_(None))
            .order_by(Memory.last_used_at.desc().nullslast(), Memory.updated_at.desc())
            .limit(actual_limit)
        )
        return list(stmt.all())
    if scope == "conversation" and conversation_id:
        stmt = (
            SessionLocal().query(Memory)
            .where(Memory.user_id == user_id)
            .where(Memory.enabled.is_(True))
            .where(Memory.status == "active")
            .where(Memory.scope == "conversation")
            .where(Memory.conversation_id == conversation_id)
            .where(Memory.archived_at.is_(None))
            .order_by(Memory.last_used_at.desc().nullslast(), Memory.updated_at.desc())
            .limit(actual_limit)
        )
        return list(stmt.all())

    return []


def _build_memory_context(memories: list[Memory]) -> dict[str, str] | None:
    """Build system context from memories."""
    if not memories:
        return None

    lines = "\n".join(f"- {memory.content}" for memory in memories)
    return {
        "role": "system",
        "content": f"以下是关于当前用户的长期记忆。仅在与当前问题相关时使用。\n{lines}",
    }


async def _stream_chat_with_context(
    context: list[dict[str, str]],
    model: str,
    reasoning_level: str | None,
    conversation_id: str,
    memory_info: ChatMemoryInfo | None = None,
) -> StreamingResponse:
    """Stream chat completion with SSE."""

    async def event_stream():
        full_response: list[str] = []
        stream_cancelled = False

        yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
        if memory_info:
            yield f"data: {json.dumps({'memory_info': memory_info.model_dump()})}\n\n"

        try:
            async for chunk in llm_service.stream_chat_completion(
                context,
                model=model,
                reasoning_level=reasoning_level,
            ):
                full_response.append(chunk)
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except asyncio.CancelledError:
            stream_cancelled = True
            raise
        except Exception as error:
            yield f"data: {json.dumps({'error': str(error)})}\n\n"
        finally:
            assistant_content = "".join(full_response)
            if assistant_content:
                save_db = SessionLocal()
                try:
                    memory_service.store_message(
                        save_db,
                        conversation_id,
                        "assistant",
                        assistant_content,
                        model=model,
                    )
                finally:
                    save_db.close()

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


@router.post("/chat")
async def chat_v1(
    body: ChatV1Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Configurable memory injection chat endpoint.

    Allows fine-grained control over memory injection:
    - memory_enabled: Enable/disable memory injection
    - memory_limit: Maximum number of memories to inject
    - memory_scope: Scope of memories (global/project/conversation/all)
    - include_memory_info: Return memory info in response
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    created_new_conversation = body.conversation_id is None

    if body.conversation_id:
        conv = _get_user_conversation(db, current_user.id, body.conversation_id)
        if body.project_id is not None and body.project_id != conv.project_id:
            raise HTTPException(status_code=400, detail="Conversation project mismatch")
    else:
        project_id = None
        if body.project_id:
            project_id = get_user_project(db, current_user.id, body.project_id).id
        conv = Conversation(user_id=current_user.id, project_id=project_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

    chosen_model = body.model or get_default_model()
    if chosen_model not in get_supported_model_ids():
        raise HTTPException(status_code=400, detail=f"Model `{chosen_model}` is not supported")

    user_message = memory_service.store_message(db, conv.id, "user", body.message.strip())

    if created_new_conversation:
        conv.title = body.message.strip()[:50] + ("..." if len(body.message.strip()) > 50 else "")
        db.commit()

    # Build context
    context: list[dict[str, str]] = []

    # Memory injection based on config
    memory_info: ChatMemoryInfo | None = None
    if body.memory.memory_enabled:
        memories = _get_memories_for_scope(
            db,
            current_user.id,
            body.memory.memory_scope,
            body.memory.memory_limit,
            conv.project_id,
            conv.id,
            query_context=body.message.strip(),  # Use user message for semantic search
        )
        memory_context = _build_memory_context(memories)
        if memory_context:
            context.append(memory_context)
        if body.memory.include_memory_info:
            memory_info = ChatMemoryInfo(
                enabled=True,
                scope=body.memory.memory_scope,
                count=len(memories),
                memory_ids=[m.id for m in memories],
            )
    else:
        if body.memory.include_memory_info:
            memory_info = ChatMemoryInfo(
                enabled=False,
                scope="none",
                count=0,
                memory_ids=[],
            )

    # Add conversation context
    conversation_context = memory_service.get_context_messages(db, conv.id, current_model=chosen_model)
    context.extend(conversation_context)

    conv_id = conv.id
    user_message_id = user_message.id

    async def event_stream():
        full_response: list[str] = []
        stream_cancelled = False

        yield f"data: {json.dumps({'conversation_id': conv_id})}\n\n"
        if memory_info:
            yield f"data: {json.dumps({'memory_info': memory_info.model_dump()})}\n\n"

        try:
            async for chunk in llm_service.stream_chat_completion(
                context,
                model=chosen_model,
                reasoning_level=body.reasoning_level,
            ):
                full_response.append(chunk)
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except asyncio.CancelledError:
            stream_cancelled = True
            raise
        except Exception as error:
            yield f"data: {json.dumps({'error': str(error)})}\n\n"
        finally:
            assistant_content = "".join(full_response)
            if assistant_content:
                save_db = SessionLocal()
                try:
                    memory_service.store_message(
                        save_db,
                        conv_id,
                        "assistant",
                        assistant_content,
                        model=chosen_model,
                        parent_message_id=user_message_id,
                    )
                finally:
                    save_db.close()

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


@router.post("/chat/auto")
async def chat_auto(
    body: ChatAutoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Auto memory injection chat endpoint.

    Automatically injects relevant memories without configuration.
    Equivalent to ChatV1Request with default memory config.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    created_new_conversation = body.conversation_id is None

    if body.conversation_id:
        conv = _get_user_conversation(db, current_user.id, body.conversation_id)
        if body.project_id is not None and body.project_id != conv.project_id:
            raise HTTPException(status_code=400, detail="Conversation project mismatch")
    else:
        project_id = None
        if body.project_id:
            project_id = get_user_project(db, current_user.id, body.project_id).id
        conv = Conversation(user_id=current_user.id, project_id=project_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

    chosen_model = body.model or get_default_model()
    if chosen_model not in get_supported_model_ids():
        raise HTTPException(status_code=400, detail=f"Model `{chosen_model}` is not supported")

    user_message = memory_service.store_message(db, conv.id, "user", body.message.strip())

    if created_new_conversation:
        conv.title = body.message.strip()[:50] + ("..." if len(body.message.strip()) > 50 else "")
        db.commit()

    # Build context with auto memory injection
    try:
        context = memory_service.get_chat_context_messages(
            db,
            current_user.id,
            conv.id,
            current_model=chosen_model,
            project_id=conv.project_id,
            query_context=body.message.strip(),  # Use user message for semantic search
        )
    except Exception:
        context = memory_service.get_context_messages(db, conv.id, current_model=chosen_model)

    conv_id = conv.id
    user_message_id = user_message.id

    async def event_stream():
        full_response: list[str] = []
        stream_cancelled = False

        yield f"data: {json.dumps({'conversation_id': conv_id})}\n\n"

        try:
            async for chunk in llm_service.stream_chat_completion(
                context,
                model=chosen_model,
                reasoning_level=body.reasoning_level,
            ):
                full_response.append(chunk)
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except asyncio.CancelledError:
            stream_cancelled = True
            raise
        except Exception as error:
            yield f"data: {json.dumps({'error': str(error)})}\n\n"
        finally:
            assistant_content = "".join(full_response)
            if assistant_content:
                save_db = SessionLocal()
                try:
                    memory_service.store_message(
                        save_db,
                        conv_id,
                        "assistant",
                        assistant_content,
                        model=chosen_model,
                        parent_message_id=user_message_id,
                    )
                finally:
                    save_db.close()

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


@router.post("/chat/simple")
async def chat_simple(
    body: ChatSimpleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pure conversation chat endpoint.

    No memory injection - only uses conversation context.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    conv = _get_user_conversation(db, current_user.id, body.conversation_id)

    chosen_model = body.model or get_default_model()
    if chosen_model not in get_supported_model_ids():
        raise HTTPException(status_code=400, detail=f"Model `{chosen_model}` is not supported")

    user_message = memory_service.store_message(db, conv.id, "user", body.message.strip())

    # Build context without memory injection
    context = memory_service.get_context_messages(db, conv.id, current_model=chosen_model)

    conv_id = conv.id
    user_message_id = user_message.id

    async def event_stream():
        full_response: list[str] = []
        stream_cancelled = False

        yield f"data: {json.dumps({'conversation_id': conv_id})}\n\n"

        try:
            async for chunk in llm_service.stream_chat_completion(
                context,
                model=chosen_model,
                reasoning_level=body.reasoning_level,
            ):
                full_response.append(chunk)
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except asyncio.CancelledError:
            stream_cancelled = True
            raise
        except Exception as error:
            yield f"data: {json.dumps({'error': str(error)})}\n\n"
        finally:
            assistant_content = "".join(full_response)
            if assistant_content:
                save_db = SessionLocal()
                try:
                    memory_service.store_message(
                        save_db,
                        conv_id,
                        "assistant",
                        assistant_content,
                        model=chosen_model,
                        parent_message_id=user_message_id,
                    )
                finally:
                    save_db.close()

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