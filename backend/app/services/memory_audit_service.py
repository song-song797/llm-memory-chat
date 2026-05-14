import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Memory, MemoryAuditLog


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_memory_state(memory: Memory) -> str:
    return json.dumps({
        "id": memory.id,
        "content": memory.content,
        "kind": memory.kind,
        "scope": memory.scope,
        "status": memory.status,
        "importance": memory.importance,
        "enabled": memory.enabled,
        "project_id": memory.project_id,
        "conversation_id": memory.conversation_id,
    }, ensure_ascii=False)


def create_audit_log(
    db: Session,
    memory_id: str,
    user_id: str,
    action: str,
    action_type: str,
    before_state: str | None = None,
    after_state: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
    request_id: str | None = None,
) -> MemoryAuditLog:
    """Create an audit log entry for a memory operation."""
    log = MemoryAuditLog(
        memory_id=memory_id,
        user_id=user_id,
        action=action,
        action_type=action_type,
        before_state=before_state,
        after_state=after_state,
        details=details,
        ip_address=ip_address,
        request_id=request_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_memory_audit_logs(
    db: Session,
    memory_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[MemoryAuditLog]:
    """Get audit logs for a specific memory."""
    stmt = (
        select(MemoryAuditLog)
        .where(MemoryAuditLog.memory_id == memory_id)
        .order_by(MemoryAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def get_global_audit_logs(
    db: Session,
    user_id: str,
    action: str | None = None,
    action_type: str | None = None,
    memory_id: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[MemoryAuditLog]:
    """Get global audit logs with filters."""
    stmt = select(MemoryAuditLog).where(MemoryAuditLog.user_id == user_id)

    if action is not None:
        stmt = stmt.where(MemoryAuditLog.action == action)
    if action_type is not None:
        stmt = stmt.where(MemoryAuditLog.action_type == action_type)
    if memory_id is not None:
        stmt = stmt.where(MemoryAuditLog.memory_id == memory_id)
    if start_time is not None:
        stmt = stmt.where(MemoryAuditLog.created_at >= start_time)
    if end_time is not None:
        stmt = stmt.where(MemoryAuditLog.created_at <= end_time)

    stmt = stmt.order_by(MemoryAuditLog.created_at.desc()).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_audit_log_count(
    db: Session,
    user_id: str,
    action: str | None = None,
    action_type: str | None = None,
    memory_id: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> int:
    """Get total count of audit logs matching filters."""
    stmt = select(MemoryAuditLog).where(MemoryAuditLog.user_id == user_id)

    if action is not None:
        stmt = stmt.where(MemoryAuditLog.action == action)
    if action_type is not None:
        stmt = stmt.where(MemoryAuditLog.action_type == action_type)
    if memory_id is not None:
        stmt = stmt.where(MemoryAuditLog.memory_id == memory_id)
    if start_time is not None:
        stmt = stmt.where(MemoryAuditLog.created_at >= start_time)
    if end_time is not None:
        stmt = stmt.where(MemoryAuditLog.created_at <= end_time)

    return len(db.execute(stmt).scalars().all())