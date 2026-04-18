import type { Conversation, Message, ModelCatalog, ReasoningLevel } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

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

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/conversations`);
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to fetch conversations'));
  }
  return res.json();
}

export async function fetchModels(): Promise<ModelCatalog> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to fetch models'));
  }
  return res.json();
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`);
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to fetch messages'));
  }
  return res.json();
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to delete conversation'));
  }
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to update conversation'));
  }
  return res.json();
}

/**
 * Send a chat message and process the SSE stream.
 * Calls onChunk for each content token, onConversationId when a new conversation is created.
 */
export async function sendMessage(
  message: string,
  conversationId: string | null,
  model: string | null,
  reasoningLevel: ReasoningLevel,
  onChunk: (content: string) => void,
  onConversationId: (id: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      model,
      reasoning_level: reasoningLevel,
    }),
  });

  if (!res.ok) {
    onError(await getErrorMessage(res, 'Failed to send message'));
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
