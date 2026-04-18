import { useCallback, useEffect, useState } from 'react';
import './App.css';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import * as api from './services/api';
import type {
  Conversation,
  Message,
  ModelOption,
  ReasoningLevel,
} from './types';

const MODEL_STORAGE_KEY = 'memory-chat:selected-model';
const REASONING_STORAGE_KEY = 'memory-chat:reasoning-level';

function getDefaultReasoningLevel(option?: ModelOption | null): ReasoningLevel {
  switch (option?.reasoning_mode) {
    case 'toggle':
    case 'budget':
      return 'off';
    case 'always_budget':
      return 'standard';
    default:
      return 'off';
  }
}

function normalizeReasoningLevel(
  level: string | null | undefined,
  option?: ModelOption | null
): ReasoningLevel {
  const requested = level === 'standard' || level === 'deep' || level === 'off' ? level : null;

  switch (option?.reasoning_mode) {
    case 'toggle':
      return requested === 'off' ? 'off' : 'standard';
    case 'budget':
      return requested ?? getDefaultReasoningLevel(option);
    case 'always_budget':
      return requested === 'deep' ? 'deep' : 'standard';
    default:
      return 'off';
  }
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('off');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStartedAt, setStreamingStartedAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    api
      .fetchConversations()
      .then((data) => {
        setConversations(data);
        setErrorMessage('');
      })
      .catch((err: Error) => {
        console.error(err);
        setErrorMessage(err.message);
      });
  }, []);

  useEffect(() => {
    api
      .fetchModels()
      .then((catalog) => {
        setModelOptions(catalog.models);

        const storedModel = window.localStorage.getItem(MODEL_STORAGE_KEY);
        const initialModel =
          storedModel && catalog.models.some((item) => item.id === storedModel)
            ? storedModel
            : catalog.default_model;
        const initialOption =
          catalog.models.find((item) => item.id === initialModel) ?? catalog.models[0] ?? null;
        const storedReasoningLevel = window.localStorage.getItem(REASONING_STORAGE_KEY);

        setSelectedModel(initialModel);
        setReasoningLevel(normalizeReasoningLevel(storedReasoningLevel, initialOption));
      })
      .catch((err: Error) => {
        console.error(err);
        setErrorMessage(err.message);
      });
  }, []);

  useEffect(() => {
    if (!selectedModel) return;
    window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    window.localStorage.setItem(REASONING_STORAGE_KEY, reasoningLevel);
  }, [reasoningLevel]);

  useEffect(() => {
    if (!selectedModel || modelOptions.length === 0) return;

    const selectedOption =
      modelOptions.find((item) => item.id === selectedModel) ?? modelOptions[0] ?? null;
    setReasoningLevel((prev) => normalizeReasoningLevel(prev, selectedOption));
  }, [selectedModel, modelOptions]);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    api
      .fetchMessages(activeConvId)
      .then((data) => {
        setMessages(data);
        setErrorMessage('');
      })
      .catch((err: Error) => {
        console.error(err);
        setErrorMessage(err.message);
      });
  }, [activeConvId]);

  const refreshConversations = useCallback(async () => {
    const convs = await api.fetchConversations();
    setConversations(convs);
    setErrorMessage('');
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setStreamingContent('');
    setErrorMessage('');
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConvId(id);
    setStreamingContent('');
    setErrorMessage('');
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        if (activeConvId === id) {
          setActiveConvId(null);
          setMessages([]);
        }
        await refreshConversations();
      } catch (err) {
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete conversation');
      }
    },
    [activeConvId, refreshConversations]
  );

  const handleSend = useCallback(
    async (message: string) => {
      if (isStreaming) return;

      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg]);
      setIsStreaming(true);
      setStreamingStartedAt(Date.now());
      setStreamingContent('');
      setErrorMessage('');

      let currentConvId = activeConvId;
      let sendFailed = false;

      try {
        await api.sendMessage(
          message,
          currentConvId,
          selectedModel || null,
          reasoningLevel,
          (chunk) => {
            setStreamingContent((prev) => prev + chunk);
          },
          (id) => {
            currentConvId = id;
            setActiveConvId(id);
          },
          (error) => {
            sendFailed = true;
            setErrorMessage(error);
            console.error('Stream error:', error);
          }
        );
      } catch (err) {
        sendFailed = true;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to send message');
        console.error(err);
      } finally {
        setIsStreaming(false);
        setStreamingStartedAt(null);
        setStreamingContent('');

        if (currentConvId) {
          try {
            const [msgs] = await Promise.all([
              api.fetchMessages(currentConvId),
              refreshConversations(),
            ]);
            setMessages(msgs);
          } catch (err) {
            console.error(err);
            setErrorMessage(
              err instanceof Error ? err.message : 'Failed to refresh conversation'
            );
          }
        } else if (sendFailed) {
          setMessages((prev) => prev.filter((msg) => msg.id !== tempUserMsg.id));
        }
      }
    },
    [activeConvId, isStreaming, refreshConversations, reasoningLevel, selectedModel]
  );

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
      />
      <ChatWindow
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        streamingStartedAt={streamingStartedAt}
        errorMessage={errorMessage}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        reasoningLevel={reasoningLevel}
        onReasoningLevelChange={setReasoningLevel}
        onSend={handleSend}
      />
    </div>
  );
}
