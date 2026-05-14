from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Memory, User
from ..schemas import (
    MemoryAuditLogListResponse,
    MemoryAuditLogOut,
    MemoryHistoryListResponse,
    MemoryHistoryOut,
)
from ..services.auth_service import get_current_user
from ..services import memory_history_service, memory_audit_service

router = APIRouter(prefix="/api", tags=["audit"])


def _get_user_memory(db: Session, user_id: str, memory_id: str) -> Memory:
    memory = db.get(Memory, memory_id)
    if not memory or memory.user_id != user_id:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.get("/memories/{memory_id}/history", response_model=MemoryHistoryListResponse)
def get_memory_history(
    memory_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get version history for a specific memory."""
    memory = _get_user_memory(db, current_user.id, memory_id)
    versions = memory_history_service.get_memory_history(
        db, memory.id, limit=limit, offset=offset
    )
    total = memory_history_service.get_history_version_count(db, memory.id)
    current_version = memory_history_service.get_current_history_version(db, memory.id)
    return MemoryHistoryListResponse(
        total=total,
        current_version=current_version.version_number if current_version else 1,
        versions=[MemoryHistoryOut.model_validate(v) for v in versions],
    )


@router.get("/memories/{memory_id}/audit", response_model=MemoryAuditLogListResponse)
def get_memory_audit_logs(
    memory_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get audit logs for a specific memory."""
    memory = _get_user_memory(db, current_user.id, memory_id)
    logs = memory_audit_service.get_memory_audit_logs(
        db, memory.id, limit=limit, offset=offset
    )
    total = len(logs)
    return MemoryAuditLogListResponse(
        total=total,
        logs=[MemoryAuditLogOut.model_validate(log) for log in logs],
    )


@router.get("/audit/logs", response_model=MemoryAuditLogListResponse)
def get_global_audit_logs(
    action: str | None = Query(default=None),
    action_type: str | None = Query(default=None),
    memory_id: str | None = Query(default=None),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get global audit logs with filters."""
    if memory_id is not None:
        _get_user_memory(db, current_user.id, memory_id)
    logs = memory_audit_service.get_global_audit_logs(
        db,
        current_user.id,
        action=action,
        action_type=action_type,
        memory_id=memory_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )
    total = memory_audit_service.get_audit_log_count(
        db,
        current_user.id,
        action=action,
        action_type=action_type,
        memory_id=memory_id,
        start_time=start_time,
        end_time=end_time,
    )
    return MemoryAuditLogListResponse(
        total=total,
        logs=[MemoryAuditLogOut.model_validate(log) for log in logs],
    )