from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Conversation, Message, User
from ..schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationOut,
    ConversationUpdate,
    MessageOut,
    MessageVersionsResponse,
    MessageVersionOut,
    RegenerateRequest,
)
from ..services.auth_service import get_current_user
from ..services.memory_service import get_conversation_messages
from ..services.project_service import get_user_project

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _get_user_conversation(db: Session, user_id: str, conversation_id: str) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if not conversation or conversation.user_id != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("", response_model=ConversationOut, status_code=201)
def create_conversation(
    body: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_id = None
    if body.project_id:
        project = get_user_project(db, current_user.id, body.project_id)
        project_id = project.id

    conversation = Conversation(title=body.title, user_id=current_user.id, project_id=project_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    project_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Conversation).where(Conversation.user_id == current_user.id)
    if project_id is not None:
        get_user_project(db, current_user.id, project_id)
        stmt = stmt.where(Conversation.project_id == project_id)
    stmt = stmt.order_by(Conversation.pinned.desc(), Conversation.updated_at.desc())
    return list(db.execute(stmt).scalars().all())


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_user_conversation(db, current_user.id, conversation_id)


@router.put("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = _get_user_conversation(db, current_user.id, conversation_id)
    if body.title is None and body.pinned is None:
        raise HTTPException(status_code=400, detail="No conversation changes provided")

    if body.title is not None:
        conversation.title = body.title
    if body.pinned is not None:
        conversation.pinned = body.pinned
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = _get_user_conversation(db, current_user.id, conversation_id)
    db.delete(conversation)
    db.commit()


@router.delete("", status_code=204)
def clear_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Conversation).where(Conversation.user_id == current_user.id)
    conversations = list(db.execute(stmt).scalars().all())
    for conversation in conversations:
        db.delete(conversation)
    db.commit()


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_user_conversation(db, current_user.id, conversation_id)
    return get_conversation_messages(db, conversation_id)


@router.get("/{conversation_id}/messages/{message_id}/versions", response_model=MessageVersionsResponse)
def get_message_versions(
    conversation_id: str,
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all versions of an assistant message."""
    _get_user_conversation(db, current_user.id, conversation_id)

    message = db.get(Message, message_id)
    if not message or message.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.role != "assistant" or message.parent_message_id is None:
        raise HTTPException(status_code=400, detail="Only assistant messages have versions")

    # Get all versions of the same parent message
    stmt = (
        select(Message)
        .where(Message.parent_message_id == message.parent_message_id)
        .order_by(Message.version_number.asc())
    )
    versions = list(db.execute(stmt).scalars().all())

    current_version = next(
        (v.version_number for v in versions if v.is_current),
        versions[-1].version_number if versions else 1,
    )

    return MessageVersionsResponse(
        total=len(versions),
        current_version=current_version,
        versions=[MessageVersionOut.model_validate(v) for v in versions],
    )


@router.put("/{conversation_id}/messages/{message_id}/versions/{version_number}", response_model=MessageOut)
def switch_message_version(
    conversation_id: str,
    message_id: str,
    version_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Switch to a specific version of an assistant message."""
    _get_user_conversation(db, current_user.id, conversation_id)

    message = db.get(Message, message_id)
    if not message or message.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.role != "assistant" or message.parent_message_id is None:
        raise HTTPException(status_code=400, detail="Only assistant messages have versions")

    # Find the target version
    stmt = (
        select(Message)
        .where(Message.parent_message_id == message.parent_message_id)
        .where(Message.version_number == version_number)
        .options(selectinload(Message.attachments))
    )
    target_version = db.execute(stmt).scalar_one_or_none()

    if not target_version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Update is_current for all versions
    db.execute(
        update(Message)
        .where(Message.parent_message_id == message.parent_message_id)
        .values(is_current=False)
    )
    target_version.is_current = True

    db.commit()
    db.refresh(target_version)

    return MessageOut.model_validate(target_version)
