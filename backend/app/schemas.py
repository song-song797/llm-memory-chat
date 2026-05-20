from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_serializer

MemoryScope = Literal["global", "project", "conversation"]
MemoryStatus = Literal["active", "archived"]
CandidateStatus = Literal["pending", "accepted", "dismissed"]
CandidateSurface = Literal["inline", "settings"]
CandidateAction = Literal["create", "update", "archive", "none"]


def _serialize_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    project_id: str | None = None
    message: str = Field(default="", max_length=10000)
    model: str | None = None
    reasoning_level: Literal["off", "standard", "deep"] | None = None
    mode: Literal["fast", "think"] | None = None


class LandingChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class LandingChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[LandingChatMessage] = Field(default_factory=list)


class ConversationCreate(BaseModel):
    title: str = "\u65b0\u5bf9\u8bdd"
    project_id: str | None = None


class ConversationUpdate(BaseModel):
    title: str | None = None
    pinned: bool | None = None


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _serialize_datetime(value)


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    default_model: str | None = Field(default=None, max_length=100)
    default_reasoning_level: Literal["off", "standard", "deep"] | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    default_model: str | None = Field(default=None, max_length=100)
    default_reasoning_level: Literal["off", "standard", "deep"] | None = None
    archived: bool | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    default_model: str | None = None
    default_reasoning_level: str | None = None
    is_default: bool
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at", "archived_at")
    def serialize_project_datetimes(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return _serialize_datetime(value)


class AttachmentOut(BaseModel):
    id: str
    name: str
    mime_type: str
    kind: str
    size_bytes: int
    content_url: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _serialize_datetime(value)


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    model: str | None = None
    parent_message_id: str | None = None
    version_number: int = 1
    is_current: bool = True
    created_at: datetime
    attachments: list[AttachmentOut] = []

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _serialize_datetime(value)


class MessageVersionOut(BaseModel):
    id: str
    version_number: int
    content: str
    model: str | None = None
    is_current: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _serialize_datetime(value)


class MessageVersionsResponse(BaseModel):
    total: int
    current_version: int
    versions: list[MessageVersionOut]


class RegenerateRequest(BaseModel):
    model: str | None = None
    reasoning_level: Literal["off", "standard", "deep"] | None = None


class ConversationOut(BaseModel):
    id: str
    title: str
    pinned: bool
    project_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, value: datetime) -> str:
        return _serialize_datetime(value)


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


class MemoryCreate(BaseModel):
    content: str = Field(..., max_length=1000)
    kind: str = Field(default="fact", max_length=40)
    scope: str = Field(default="global", max_length=20)
    project_id: str | None = None
    conversation_id: str | None = None
    status: str = Field(default="active", max_length=20)
    importance: int = 0
    superseded_by_id: str | None = None


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, max_length=1000)
    kind: str | None = Field(default=None, max_length=40)
    enabled: bool | None = None
    scope: str | None = Field(default=None, max_length=20)
    project_id: str | None = None
    conversation_id: str | None = None
    status: str | None = Field(default=None, max_length=20)
    importance: int | None = None
    superseded_by_id: str | None = None


class MemoryOut(BaseModel):
    id: str
    content: str
    kind: str
    enabled: bool
    scope: str
    project_id: str | None = None
    conversation_id: str | None = None
    status: str
    importance: int
    superseded_by_id: str | None = None
    source_candidate_id: str | None = None
    created_at: datetime
    updated_at: datetime
    last_used_at: datetime | None = None
    archived_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at", "last_used_at", "archived_at")
    def serialize_memory_datetimes(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return _serialize_datetime(value)


class MemoryCandidateOut(BaseModel):
    id: str
    project_id: str | None = None
    conversation_id: str | None = None
    target_memory_id: str | None = None
    accepted_memory_id: str | None = None
    source_message_id: str | None = None
    scope: str
    action: str
    content: str
    kind: str
    confidence: int
    importance: int
    reason: str | None = None
    status: str
    surface: str
    extraction_model: str | None = None
    presented_at: datetime | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer(
        "presented_at",
        "reviewed_at",
        "created_at",
        "updated_at",
    )
    def serialize_candidate_datetimes(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return _serialize_datetime(value)


class MemoryCandidateAccept(BaseModel):
    content: str | None = Field(default=None, max_length=1000)
    kind: str | None = Field(default=None, max_length=40)
    scope: MemoryScope | None = None
    project_id: str | None = None
    conversation_id: str | None = None
    importance: int | None = None


class MemoryCandidateReviewOut(BaseModel):
    candidate: MemoryCandidateOut
    memory: MemoryOut | None = None
    archived_memory_id: str | None = None


class MemoryDocumentOut(BaseModel):
    id: str
    project_id: str | None = None
    conversation_id: str | None = None
    scope: str
    content_md: str
    source_memory_ids: str
    revision: int
    is_stale: bool
    generated_by: str
    generation_model: str | None = None
    generation_error: str | None = None
    generated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("generated_at", "created_at", "updated_at")
    def serialize_document_datetimes(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return _serialize_datetime(value)


class ModelOption(BaseModel):
    id: str
    label: str
    latency_hint: str | None = None
    reasoning_mode: Literal["none", "toggle", "budget", "always_budget"] = "none"
    experimental_reasoning: bool = False


class ModelCatalog(BaseModel):
    default_model: str
    models: list[ModelOption]


# Memory History schemas
class MemoryHistoryOut(BaseModel):
    id: str
    memory_id: str
    parent_history_id: str | None = None
    version_number: int
    is_current: bool
    content: str
    kind: str
    scope: str
    status: str
    importance: int
    enabled: bool
    change_reason: str | None = None
    changed_by_action: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _serialize_datetime(value)


class MemoryHistoryListResponse(BaseModel):
    total: int
    current_version: int
    versions: list[MemoryHistoryOut]


# Memory Audit Log schemas
AuditAction = Literal["create", "update", "delete", "access", "archive"]
AuditActionType = Literal["manual", "api", "automatic", "system"]


class MemoryAuditLogOut(BaseModel):
    id: str
    memory_id: str
    user_id: str
    action: str
    action_type: str
    before_state: str | None = None
    after_state: str | None = None
    details: str | None = None
    ip_address: str | None = None
    request_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _serialize_datetime(value)


class MemoryAuditLogListResponse(BaseModel):
    total: int
    logs: list[MemoryAuditLogOut]


# Chat V1 schemas
MemoryInjectionScope = Literal["global", "project", "conversation", "all"]


class MemoryInjectionConfig(BaseModel):
    memory_enabled: bool = True
    memory_limit: int | None = Field(default=None, ge=1, le=100)
    memory_scope: MemoryInjectionScope = "all"
    include_memory_info: bool = False


class ChatV1Request(BaseModel):
    conversation_id: str | None = None
    project_id: str | None = None
    message: str = Field(default="", max_length=10000)
    model: str | None = None
    reasoning_level: Literal["off", "standard", "deep"] | None = None
    mode: Literal["fast", "think"] | None = None
    memory: MemoryInjectionConfig = Field(default_factory=MemoryInjectionConfig)


class ChatAutoRequest(BaseModel):
    conversation_id: str | None = None
    project_id: str | None = None
    message: str = Field(default="", max_length=10000)
    model: str | None = None
    reasoning_level: Literal["off", "standard", "deep"] | None = None
    mode: Literal["fast", "think"] | None = None


class ChatSimpleRequest(BaseModel):
    conversation_id: str
    message: str = Field(default="", max_length=10000)
    model: str | None = None
    reasoning_level: Literal["off", "standard", "deep"] | None = None
    mode: Literal["fast", "think"] | None = None


class ChatMemoryInfo(BaseModel):
    enabled: bool
    scope: str
    count: int
    memory_ids: list[str] = []


# Api Debug History schemas
class DebugHistoryCreate(BaseModel):
    model: str = Field(..., max_length=100)
    messages: str  # JSON string
    max_tokens: int = 1024
    stream: bool = True
    include_usage: bool = True
    thinking_enabled: bool = False
    reasoning_level: Literal["off", "standard", "deep"] | None = None
    response_status: int = 0
    response_time_ms: int = 0
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    error_message: str | None = None


class DebugHistoryOut(BaseModel):
    id: str
    model: str
    messages: str
    max_tokens: int
    stream: bool
    include_usage: bool
    thinking_enabled: bool
    reasoning_level: str | None = None
    response_status: int
    response_time_ms: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    error_message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _serialize_datetime(value)
