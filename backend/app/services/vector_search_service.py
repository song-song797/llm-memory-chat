"""Vector search service for semantic memory retrieval."""

import json
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Memory, MemoryEmbedding
from .embedding_service import create_embedding


def search_similar_memories(
    db: Session,
    query_embedding: list[float],
    user_id: str,
    scope: str | None = None,
    project_id: str | None = None,
    conversation_id: str | None = None,
    top_k: int | None = None,
    threshold: float | None = None,
) -> list[tuple[Memory, float]]:
    """Search memories by vector similarity.

    Args:
        db: Database session.
        query_embedding: The query vector.
        user_id: The user ID.
        scope: Optional scope filter (global/project/conversation).
        project_id: Optional project ID for project scope.
        conversation_id: Optional conversation ID for conversation scope.
        top_k: Maximum number of results (default from config).
        threshold: Minimum similarity threshold (default from config).

    Returns:
        List of (Memory, similarity_score) tuples.
    """
    if not settings.EMBEDDING_ENABLED:
        return []

    actual_top_k = top_k or settings.VECTOR_SEARCH_TOP_K
    actual_threshold = threshold or settings.VECTOR_SEARCH_THRESHOLD

    # Build base query for PostgreSQL with pgvector
    # Only works on PostgreSQL - other databases will fall back
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return []

    query_vector_str = json.dumps(query_embedding)

    # Build SQL query with vector similarity search
    sql = """
        SELECT m.id, m.user_id, m.project_id, m.conversation_id, m.content,
               m.kind, m.scope, m.status, m.importance, m.enabled,
               m.created_at, m.updated_at, m.last_used_at, m.archived_at,
               m.source_message_id, m.superseded_by_id, m.source_candidate_id,
               1 - (e.embedding <=> :query_vector::vector) as similarity
        FROM memories m
        JOIN memory_embeddings e ON m.id = e.memory_id
        WHERE m.user_id = :user_id
          AND m.enabled = true
          AND m.status = 'active'
          AND e.status = 'ready'
          AND m.archived_at IS NULL
    """

    params = {
        "query_vector": query_vector_str,
        "user_id": user_id,
    }

    # Add scope filters
    if scope == "global":
        sql += " AND m.scope = 'global'"
    elif scope == "project" and project_id:
        sql += " AND m.scope = 'project' AND m.project_id = :project_id"
        params["project_id"] = project_id
    elif scope == "conversation" and conversation_id:
        sql += " AND m.scope = 'conversation' AND m.conversation_id = :conversation_id"
        params["conversation_id"] = conversation_id
    elif scope == "all":
        # Include all scopes with proper filters
        pass

    # Add similarity threshold and ordering
    sql += f"""
        AND 1 - (e.embedding <=> :query_vector::vector) >= {actual_threshold}
        ORDER BY e.embedding <=> :query_vector::vector
        LIMIT {actual_top_k}
    """

    result = db.execute(text(sql), params)

    memories_with_scores: list[tuple[Memory, float]] = []
    for row in result:
        # Create Memory object from row
        memory = Memory(
            id=row.id,
            user_id=row.user_id,
            project_id=row.project_id,
            conversation_id=row.conversation_id,
            content=row.content,
            kind=row.kind,
            scope=row.scope,
            status=row.status,
            importance=row.importance,
            enabled=row.enabled,
            created_at=row.created_at,
            updated_at=row.updated_at,
            last_used_at=row.last_used_at,
            archived_at=row.archived_at,
            source_message_id=row.source_message_id,
            superseded_by_id=row.superseded_by_id,
            source_candidate_id=row.source_candidate_id,
        )
        similarity = float(row.similarity)
        memories_with_scores.append((memory, similarity))

    return memories_with_scores


def search_memories_by_text(
    db: Session,
    query_text: str,
    user_id: str,
    scope: str | None = None,
    project_id: str | None = None,
    conversation_id: str | None = None,
    top_k: int | None = None,
    threshold: float | None = None,
) -> list[Memory]:
    """Search memories by text using semantic similarity.

    Generates embedding for query text and searches for similar memories.

    Args:
        db: Database session.
        query_text: The query text.
        user_id: The user ID.
        scope: Optional scope filter.
        project_id: Optional project ID.
        conversation_id: Optional conversation ID.
        top_k: Maximum results.
        threshold: Minimum similarity threshold.

    Returns:
        List of similar memories.
    """
    if not settings.EMBEDDING_ENABLED:
        return []

    try:
        query_embedding = create_embedding(query_text)
        results = search_similar_memories(
            db,
            query_embedding,
            user_id,
            scope=scope,
            project_id=project_id,
            conversation_id=conversation_id,
            top_k=top_k,
            threshold=threshold,
        )
        return [memory for memory, _ in results]
    except Exception:
        return []


def is_vector_search_available(db: Session) -> bool:
    """Check if vector search is available.

    Args:
        db: Database session.

    Returns:
        True if PostgreSQL with pgvector, False otherwise.
    """
    if not settings.EMBEDDING_ENABLED:
        return False

    bind = db.get_bind()
    return bind.dialect.name == "postgresql"