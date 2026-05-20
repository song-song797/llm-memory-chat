import type {
  Attachment,
  AuthResponse,
  Conversation,
  DebugHistoryEntry,
  LandingAgentMessage,
  Memory,
  MemoryCandidate,
  MemoryDocument,
  MemoryCandidateReviewResult,
  MemoryScope,
  Message,
  MessageVersionsResponse,
  ModelCatalog,
  Project,
  ReasoningLevel,
  User,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
const API_ROOT = API_BASE.replace(/\/api\/?$/, '');

let authToken: string | null = null;

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ROOT}${normalizedPath}`;
}

function getAuthHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  const authHeaders = getAuthHeaders();

  Object.entries(authHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return fetch(input, {
    ...init,
    headers,
  });
}

function normalizeAttachment(attachment: Attachment): Attachment {
  return {
    ...attachment,
    content_url: resolveApiUrl(attachment.content_url),
  };
}

export async function fetchAttachmentBlobUrl(
  contentUrl: string
): Promise<{ url: string; revokeOnCleanup: boolean }> {
  if (/^(blob:|data:|https?:\/\/)/i.test(contentUrl) && !contentUrl.includes('/api/attachments/')) {
    return {
      url: contentUrl,
      revokeOnCleanup: false,
    };
  }

  const res = await apiFetch(contentUrl);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to load attachment');
    throw new Error(errorMessage);
  }

  const blob = await res.blob();
  return {
    url: URL.createObjectURL(blob),
    revokeOnCleanup: true,
  };
}

function normalizeMessage(message: Message): Message {
  return {
    ...message,
    attachments: message.attachments?.map(normalizeAttachment) ?? [],
  };
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') {
      return data.detail;
    }
  } catch {
    // Ignore invalid JSON error bodies.
  }

  return fallback;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to register');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to login');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await apiFetch(`${API_BASE}/auth/me`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch current user');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await apiFetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });
  if (!res.ok && res.status !== 401) {
    const errorMessage = await getErrorMessage(res, 'Failed to logout');
    throw new Error(errorMessage);
  }
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiFetch(`${API_BASE}/conversations`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch conversations');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchModels(): Promise<ModelCatalog> {
  const res = await apiFetch(`${API_BASE}/models`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch models');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchProjects(includeArchived = false): Promise<Project[]> {
  const query = includeArchived ? '?include_archived=true' : '';
  const res = await apiFetch(`${API_BASE}/projects${query}`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch projects');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function createProject(input: {
  name: string;
  description?: string | null;
  default_model?: string | null;
  default_reasoning_level?: ReasoningLevel | null;
}): Promise<Project> {
  const res = await apiFetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to create project');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    description?: string | null;
    default_model?: string | null;
    default_reasoning_level?: ReasoningLevel | null;
    archived?: boolean;
  }
): Promise<Project> {
  const res = await apiFetch(`${API_BASE}/projects/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to update project');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await apiFetch(`${API_BASE}/conversations/${conversationId}/messages`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch messages');
    throw new Error(errorMessage);
  }

  const data: Message[] = await res.json();
  return data.map(normalizeMessage);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/conversations/${conversationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to delete conversation');
    throw new Error(errorMessage);
  }
}

export async function clearAllConversations(): Promise<void> {
  const res = await apiFetch(`${API_BASE}/conversations`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to clear conversations');
    throw new Error(errorMessage);
  }
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<Conversation> {
  return updateConversation(conversationId, { title });
}

export async function updateConversation(
  conversationId: string,
  updates: { title?: string; pinned?: boolean }
): Promise<Conversation> {
  const res = await apiFetch(`${API_BASE}/conversations/${conversationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to update conversation');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchMemories(options: {
  scope?: MemoryScope;
  projectId?: string | null;
  conversationId?: string | null;
  includeArchived?: boolean;
} = {}): Promise<Memory[]> {
  const params = new URLSearchParams();
  if (options.scope) params.set('scope', options.scope);
  if (options.projectId) params.set('project_id', options.projectId);
  if (options.conversationId) params.set('conversation_id', options.conversationId);
  if (options.includeArchived) params.set('include_archived', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await apiFetch(`${API_BASE}/memories${query}`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch memories');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchMemoryDocuments(options: {
  scope?: MemoryScope;
  projectId?: string | null;
  conversationId?: string | null;
} = {}): Promise<MemoryDocument[]> {
  const params = new URLSearchParams();
  if (options.scope) params.set('scope', options.scope);
  if (options.projectId) params.set('project_id', options.projectId);
  if (options.conversationId) params.set('conversation_id', options.conversationId);
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await apiFetch(`${API_BASE}/memory-documents${query}`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch memory documents');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function createMemory(
  input:
    | string
    | {
        content: string;
        kind?: string;
        scope?: MemoryScope;
        projectId?: string | null;
        conversationId?: string | null;
      },
  kind = 'fact'
): Promise<Memory> {
  const payload =
    typeof input === 'string'
      ? {
          content: input,
          kind,
          scope: 'global',
          project_id: null,
        }
      : {
          content: input.content,
          kind: input.kind ?? 'fact',
          scope: input.scope ?? 'global',
          project_id: input.projectId ?? null,
          conversation_id: input.conversationId ?? null,
        };

  const res = await apiFetch(`${API_BASE}/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to create memory');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function updateMemory(
  memoryId: string,
  updates: {
    content?: string;
    kind?: string;
    enabled?: boolean;
    scope?: MemoryScope;
    projectId?: string | null;
    conversationId?: string | null;
    status?: 'active' | 'archived';
    importance?: number;
    supersededById?: string | null;
  }
): Promise<Memory> {
  const payload = {
    content: updates.content,
    kind: updates.kind,
    enabled: updates.enabled,
    scope: updates.scope,
    project_id: updates.projectId,
    conversation_id: updates.conversationId,
    status: updates.status,
    importance: updates.importance,
    superseded_by_id: updates.supersededById,
  };

  const res = await apiFetch(`${API_BASE}/memories/${memoryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to update memory');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/memories/${memoryId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to delete memory');
    throw new Error(errorMessage);
  }
}

export async function fetchMemoryCandidates(options: {
  status?: string;
  surface?: 'inline' | 'settings';
  scope?: MemoryScope;
  projectId?: string | null;
  conversationId?: string | null;
} = {}): Promise<MemoryCandidate[]> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.surface) params.set('surface', options.surface);
  if (options.scope) params.set('scope', options.scope);
  if (options.projectId) params.set('project_id', options.projectId);
  if (options.conversationId) params.set('conversation_id', options.conversationId);
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await apiFetch(`${API_BASE}/memory-candidates${query}`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch memory candidates');
    throw new Error(errorMessage);
  }
  return res.json();
}

async function parseOptionalJson<T>(res: Response): Promise<T | null> {
  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

export async function acceptMemoryCandidate(
  candidateId: string,
  content?: string
): Promise<MemoryCandidateReviewResult> {
  const res = await apiFetch(`${API_BASE}/memory-candidates/${candidateId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content ? { content } : {}),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to accept memory candidate');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function dismissMemoryCandidate(candidateId: string): Promise<MemoryCandidate | null> {
  const res = await apiFetch(`${API_BASE}/memory-candidates/${candidateId}/dismiss`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to dismiss memory candidate');
    throw new Error(errorMessage);
  }
  return parseOptionalJson<MemoryCandidate>(res);
}

export async function deferMemoryCandidate(candidateId: string): Promise<MemoryCandidate | null> {
  const res = await apiFetch(`${API_BASE}/memory-candidates/${candidateId}/defer`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to defer memory candidate');
    throw new Error(errorMessage);
  }
  return parseOptionalJson<MemoryCandidate>(res);
}

export async function sendMessage(
  message: string,
  attachments: File[],
  conversationId: string | null,
  projectId: string | null,
  model: string | null,
  reasoningLevel: ReasoningLevel,
  onChunk: (content: string) => void,
  onConversationId: (id: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData();
  formData.append('message', message);

  if (conversationId) {
    formData.append('conversation_id', conversationId);
  }

  if (projectId) {
    formData.append('project_id', projectId);
  }

  if (model) {
    formData.append('model', model);
  }

  formData.append('reasoning_level', reasoningLevel);

  for (const attachment of attachments) {
    formData.append('files', attachment);
  }

  const res = await apiFetch(`${API_BASE}/chat`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to send message');
    onError(errorMessage);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError('No response stream');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();

      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.conversation_id) {
          onConversationId(parsed.conversation_id);
        }
        if (parsed.content) {
          onChunk(parsed.content);
        }
        if (parsed.error) {
          onError(parsed.error);
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
}

export async function sendLandingAgentMessage(
  message: string,
  history: LandingAgentMessage[],
  onChunk: (content: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/landing-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to contact guide agent');
    onError(errorMessage);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError('No response stream');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }

      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        return;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.content) {
          onChunk(parsed.content);
        }
        if (parsed.error) {
          onError(parsed.error);
        }
      } catch {
        // Skip malformed JSON chunks.
      }
    }
  }
}

export async function regenerateMessage(
  conversationId: string,
  messageId: string,
  options: {
    model?: string | null;
    reasoningLevel?: ReasoningLevel;
  } = {},
  onChunk: (content: string) => void,
  onConversationId: (id: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/conversations/${conversationId}/messages/${messageId}/regenerate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        reasoning_level: options.reasoningLevel,
      }),
      signal,
    }
  );

  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to regenerate message');
    onError(errorMessage);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError('No response stream');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();

      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.conversation_id) {
          onConversationId(parsed.conversation_id);
        }
        if (parsed.content) {
          onChunk(parsed.content);
        }
        if (parsed.error) {
          onError(parsed.error);
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
}

export async function getMessageVersions(
  conversationId: string,
  messageId: string
): Promise<MessageVersionsResponse> {
  const res = await apiFetch(
    `${API_BASE}/conversations/${conversationId}/messages/${messageId}/versions`
  );
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch message versions');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function switchMessageVersion(
  conversationId: string,
  messageId: string,
  versionNumber: number
): Promise<Message> {
  const res = await apiFetch(
    `${API_BASE}/conversations/${conversationId}/messages/${messageId}/versions/${versionNumber}`,
    {
      method: 'PUT',
    }
  );
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to switch message version');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchDebugHistory(
  limit = 50,
  offset = 0
): Promise<DebugHistoryEntry[]> {
  const res = await apiFetch(`${API_BASE}/debug-history?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to fetch debug history');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function createDebugHistory(input: {
  model: string;
  messages: string;
  max_tokens: number;
  stream: boolean;
  include_usage: boolean;
  thinking_enabled: boolean;
  reasoning_level?: string | null;
  response_status: number;
  response_time_ms: number;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  error_message?: string | null;
}): Promise<DebugHistoryEntry> {
  const res = await apiFetch(`${API_BASE}/debug-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to create debug history');
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function deleteDebugHistoryEntry(entryId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/debug-history/${entryId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to delete debug history entry');
    throw new Error(errorMessage);
  }
}

export async function clearDebugHistory(): Promise<void> {
  const res = await apiFetch(`${API_BASE}/debug-history`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res, 'Failed to clear debug history');
    throw new Error(errorMessage);
  }
}
