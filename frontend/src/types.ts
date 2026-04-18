export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
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
