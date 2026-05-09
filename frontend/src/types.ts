export interface Attachment {
  id: string;
  name: string;
  mime_type: string;
  kind: 'image' | 'file';
  size_bytes: number;
  content_url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string | null;
  parent_message_id?: string | null;
  version_number?: number;
  is_current?: boolean;
  created_at: string;
  attachments?: Attachment[];
}

export interface MessageVersion {
  id: string;
  version_number: number;
  content: string;
  model?: string | null;
  is_current: boolean;
  created_at: string;
}

export interface MessageVersionsResponse {
  total: number;
  current_version: number;
  versions: MessageVersion[];
}

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  default_model?: string | null;
  default_reasoning_level?: ReasoningLevel | null;
  is_default: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type MemoryScope = 'global' | 'project' | 'conversation';
export type MemoryStatus = 'active' | 'archived';
export type MemoryCandidateStatus = 'pending' | 'accepted' | 'dismissed';
export type MemoryCandidateSurface = 'inline' | 'settings';
export type MemoryCandidateAction = 'create' | 'update' | 'archive' | 'none';

export interface Memory {
  id: string;
  content: string;
  kind: string;
  scope?: MemoryScope;
  project_id?: string | null;
  conversation_id?: string | null;
  source_candidate_id?: string | null;
  status?: MemoryStatus;
  importance?: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  last_used_at?: string | null;
  superseded_by_id?: string | null;
}

export interface MemoryCandidate {
  id: string;
  content: string;
  kind?: string | null;
  scope: MemoryScope;
  project_id?: string | null;
  conversation_id?: string | null;
  action: MemoryCandidateAction;
  target_memory_id?: string | null;
  confidence: number;
  importance: number;
  status: MemoryCandidateStatus;
  surface: MemoryCandidateSurface;
  accepted_memory_id?: string | null;
  source_message_id?: string | null;
  reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MemoryCandidateReviewResult {
  candidate: MemoryCandidate;
  memory?: Memory | null;
  archived_memory_id?: string | null;
}

export interface MemoryDocument {
  id: string;
  scope: MemoryScope;
  project_id?: string | null;
  conversation_id?: string | null;
  content_md: string;
  source_memory_ids: string;
  revision: number;
  is_stale: boolean;
  generated_by: 'ai' | 'fallback' | string;
  generation_model?: string | null;
  generation_error?: string | null;
  generated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LandingAgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ReasoningMode = 'none' | 'toggle' | 'budget' | 'always_budget';
export type ReasoningLevel = 'off' | 'standard' | 'deep';

export interface ModelOption {
  id: string;
  label: string;
  latency_hint?: string | null;
  reasoning_mode: ReasoningMode;
  experimental_reasoning: boolean;
}

export interface ModelCatalog {
  default_model: string;
  models: ModelOption[];
}

export interface ComposerAttachment {
  id: string;
  file: File;
  name: string;
  mime_type: string;
  kind: 'image' | 'file';
  size_bytes: number;
  preview_url?: string;
}
