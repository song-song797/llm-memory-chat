"""Memory embedding service for managing memory vector embeddings."""

from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Memory, MemoryEmbedding
from .embedding_service import create_embedding, get_content_hash


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def needs_embedding_update(memory: Memory, embedding: MemoryEmbedding | None) -> bool:
    """Check if embedding needs to be generated or updated.

    Args:
        memory: The memory record.
        embedding: The existing embedding record (if any).

    Returns:
        True if embedding needs update, False otherwise.
    """
    if not settings.EMBEDDING_ENABLED:
        return False

    if embedding is None:
        return True

    # Check if content changed
    current_hash = get_content_hash(memory.content)
    if embedding.content_hash != current_hash:
        return True

    # Check if embedding failed and should retry
    if embedding.status == "failed":
        return True

    # Check if embedding is pending
    if embedding.status == "pending":
        return True

    return False


def create_or_update_embedding(db: Session, memory: Memory) -> MemoryEmbedding:
    """Create or update embedding for a memory.

    Args:
        db: Database session.
        memory: The memory record.

    Returns:
        The embedding record.

    Raises:
        Exception: If embedding generation fails.
    """
    if not settings.EMBEDDING_ENABLED:
        raise ValueError("Embedding is disabled")

    content_hash = get_content_hash(memory.content)

    # Check existing embedding
    stmt = select(MemoryEmbedding).where(MemoryEmbedding.memory_id == memory.id)
    existing = db.execute(stmt).scalar_one_or_none()

    try:
        embedding_vector = create_embedding(memory.content)

        if existing:
            existing.embedding = embedding_vector
            existing.content_hash = content_hash
            existing.model_name = settings.EMBEDDING_MODEL
            existing.status = "ready"
            existing.error_message = None
            existing.updated_at = _utcnow()
            db.commit()
            db.refresh(existing)
            return existing

        # Create new embedding
        new_embedding = MemoryEmbedding(
            memory_id=memory.id,
            embedding=embedding_vector,
            model_name=settings.EMBEDDING_MODEL,
            content_hash=content_hash,
            status="ready",
        )
        db.add(new_embedding)
        db.commit()
        db.refresh(new_embedding)
        return new_embedding

    except Exception as e:
        error_msg = str(e)
        if existing:
            existing.status = "failed"
            existing.error_message = error_msg
            existing.updated_at = _utcnow()
            db.commit()
            db.refresh(existing)
            return existing

        # Create failed embedding record
        failed_embedding = MemoryEmbedding(
            memory_id=memory.id,
            embedding=None,
            model_name=settings.EMBEDDING_MODEL,
            content_hash=content_hash,
            status="failed",
            error_message=error_msg,
        )
        db.add(failed_embedding)
        db.commit()
        db.refresh(failed_embedding)
        return failed_embedding


def generate_embedding_async(memory_id: str, content: str) -> None:
    """Generate embedding asynchronously (for BackgroundTasks).

    Creates a new database session and generates embedding.

    Args:
        memory_id: The memory ID.
        content: The memory content to embed.
    """
    if not settings.EMBEDDING_ENABLED:
        return

    from ..database import SessionLocal

    db = SessionLocal()
    try:
        memory = db.get(Memory, memory_id)
        if not memory:
            return

        create_or_update_embedding(db, memory)
    except Exception:
        # Log error but don't raise - background task
        pass
    finally:
        db.close()


def get_pending_embeddings(db: Session, limit: int = 50) -> list[Memory]:
    """Get memories that need embedding generation.

    Args:
        db: Database session.
        limit: Maximum number of memories to return.

    Returns:
        List of memories needing embedding.
    """
    if not settings.EMBEDDING_ENABLED:
        return []

    # Find memories without embedding or with pending/failed status
    stmt = (
        select(Memory)
        .where(Memory.enabled.is_(True))
        .where(Memory.status == "active")
        .where(Memory.archived_at.is_(None))
    )

    memories = list(db.execute(stmt).scalars().all())

    pending = []
    for memory in memories:
        emb_stmt = select(MemoryEmbedding).where(MemoryEmbedding.memory_id == memory.id)
        embedding = db.execute(emb_stmt).scalar_one_or_none()

        if needs_embedding_update(memory, embedding):
            pending.append(memory)
            if len(pending) >= limit:
                break

    return pending


def get_embedding_for_memory(db: Session, memory_id: str) -> MemoryEmbedding | None:
    """Get embedding record for a memory.

    Args:
        db: Database session.
        memory_id: The memory ID.

    Returns:
        The embedding record or None.
    """
    stmt = select(MemoryEmbedding).where(MemoryEmbedding.memory_id == memory_id)
    return db.execute(stmt).scalar_one_or_none()