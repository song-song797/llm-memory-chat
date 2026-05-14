import json
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..models import Memory, MemoryHistory


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_memory_state(memory: Memory) -> str:
    """Serialize memory state for audit logging."""
    return json.dumps({
        "content": memory.content,
        "kind": memory.kind,
        "scope": memory.scope,
        "status": memory.status,
        "importance": memory.importance,
        "enabled": memory.enabled,
    }, ensure_ascii=False)


def create_history_version(
    db: Session,
    memory: Memory,
    action: str,
    change_reason: str | None = None,
) -> MemoryHistory:
    """Create a new history version for a memory.

    Marks previous versions as non-current and creates a new current version.
    """
    # Mark previous versions as non-current
    stmt = (
        update(MemoryHistory)
        .where(MemoryHistory.memory_id == memory.id)
        .where(MemoryHistory.is_current.is_(True))
        .values(is_current=False)
    )
    db.execute(stmt)

    # Get the previous current version for parent_history_id
    stmt = (
        select(MemoryHistory)
        .where(MemoryHistory.memory_id == memory.id)
        .order_by(MemoryHistory.version_number.desc())
        .limit(1)
    )
    previous_version = db.execute(stmt).scalar_one_or_none()

    # Calculate new version number
    version_number = 1
    parent_history_id = None
    if previous_version:
        version_number = previous_version.version_number + 1
        parent_history_id = previous_version.id

    # Create new history version
    history = MemoryHistory(
        memory_id=memory.id,
        parent_history_id=parent_history_id,
        version_number=version_number,
        is_current=True,
        content=memory.content,
        kind=memory.kind,
        scope=memory.scope,
        status=memory.status,
        importance=memory.importance,
        enabled=memory.enabled,
        change_reason=change_reason,
        changed_by_action=action,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def get_memory_history(
    db: Session,
    memory_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[MemoryHistory]:
    """Get history versions for a memory."""
    stmt = (
        select(MemoryHistory)
        .where(MemoryHistory.memory_id == memory_id)
        .order_by(MemoryHistory.version_number.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def get_current_history_version(
    db: Session,
    memory_id: str,
) -> MemoryHistory | None:
    """Get the current history version for a memory."""
    stmt = (
        select(MemoryHistory)
        .where(MemoryHistory.memory_id == memory_id)
        .where(MemoryHistory.is_current.is_(True))
    )
    return db.execute(stmt).scalar_one_or_none()


def get_history_version_count(
    db: Session,
    memory_id: str,
) -> int:
    """Get total number of history versions for a memory."""
    stmt = (
        select(MemoryHistory)
        .where(MemoryHistory.memory_id == memory_id)
    )
    return len(db.execute(stmt).scalars().all())