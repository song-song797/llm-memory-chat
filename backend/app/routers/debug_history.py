from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ApiDebugHistory, User
from ..schemas import DebugHistoryCreate, DebugHistoryOut
from ..services.auth_service import get_current_user

router = APIRouter(prefix="/api/debug-history", tags=["debug-history"])


@router.get("", response_model=list[DebugHistoryOut])
def list_debug_history(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(ApiDebugHistory)
        .where(ApiDebugHistory.user_id == current_user.id)
        .order_by(ApiDebugHistory.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


@router.post("", response_model=DebugHistoryOut, status_code=201)
def create_debug_history(
    body: DebugHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = ApiDebugHistory(
        user_id=current_user.id,
        model=body.model,
        messages=body.messages,
        max_tokens=body.max_tokens,
        stream=body.stream,
        include_usage=body.include_usage,
        thinking_enabled=body.thinking_enabled,
        reasoning_level=body.reasoning_level,
        response_status=body.response_status,
        response_time_ms=body.response_time_ms,
        prompt_tokens=body.prompt_tokens,
        completion_tokens=body.completion_tokens,
        total_tokens=body.total_tokens,
        error_message=body.error_message,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_debug_history_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ApiDebugHistory).where(
        ApiDebugHistory.id == entry_id,
        ApiDebugHistory.user_id == current_user.id,
    )
    entry = db.execute(stmt).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Debug history entry not found")
    db.delete(entry)
    db.commit()


@router.delete("", status_code=204)
def clear_debug_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ApiDebugHistory).where(ApiDebugHistory.user_id == current_user.id)
    entries = db.execute(stmt).scalars().all()
    for entry in entries:
        db.delete(entry)
    db.commit()