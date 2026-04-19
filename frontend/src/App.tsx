import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import ChatWindow from './components/ChatWindow';
import Icon from './components/Icons';
import SettingsDrawer from './components/SettingsDrawer';
import Sidebar from './components/Sidebar';
import SignUpScreen from './components/SignUpScreen';
import * as api from './services/api';
import type {
  Conversation,
  Message,
  ModelOption,
  ReasoningLevel,
} from './types';

const MODEL_STORAGE_KEY = 'memory-chat:selected-model';
const REASONING_STORAGE_KEY = 'memory-chat:reasoning-level';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'memory-chat:sidebar-collapsed';
const VIEW_STORAGE_KEY = 'memory-chat:active-view';

type AppView = 'signup' | 'chat';
type ChatTheme = 'rose' | 'butter' | 'mist' | 'mint' | 'neutral';

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
  const requested =
    level === 'standard' || level === 'deep' || level === 'off' ? level : null;

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

function getConversationTheme(_conversationId: string | null): ChatTheme {
  return 'neutral';
}

export default function App() {
  const [appView, setAppView] = useState<AppView>(() => {
    const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return storedView === 'chat' ? 'chat' : 'signup';
  });
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  });

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
    window.localStorage.setItem(VIEW_STORAGE_KEY, appView);
  }, [appView]);

  useEffect(() => {
    if (!selectedModel) return;
    window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    window.localStorage.setItem(REASONING_STORAGE_KEY, reasoningLevel);
  }, [reasoningLevel]);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      isSidebarCollapsed ? 'true' : 'false'
    );
  }, [isSidebarCollapsed]);

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

  const handleEnterChat = useCallback(() => {
    setAppView('chat');
    setErrorMessage('');
    setIsMobileSidebarOpen(false);
  }, []);

  const handleNewChat = useCallback(() => {
    setAppView('chat');
    setActiveConvId(null);
    setMessages([]);
    setStreamingContent('');
    setErrorMessage('');
    setIsMobileSidebarOpen(false);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setAppView('chat');
    setActiveConvId(id);
    setStreamingContent('');
    setErrorMessage('');
    setIsMobileSidebarOpen(false);
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        if (activeConvId === id) {
          setActiveConvId(null);
          setMessages([]);
        }
        setIsMobileSidebarOpen(false);
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

      setAppView('chat');

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
    [activeConvId, isStreaming, reasoningLevel, refreshConversations, selectedModel]
  );

  const currentTheme = useMemo(
    () => getConversationTheme(activeConvId),
    [activeConvId]
  );

  const selectedModelOption = useMemo(
    () =>
      modelOptions.find((option) => option.id === selectedModel) ?? modelOptions[0] ?? null,
    [modelOptions, selectedModel]
  );

  if (appView === 'signup') {
    return <SignUpScreen onEnter={handleEnterChat} />;
  }

  return (
    <div className={`app-shell theme-${currentTheme} ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <button
        type="button"
        className={`mobile-sidebar-backdrop ${isMobileSidebarOpen ? 'is-open' : ''}`}
        aria-label="Close conversations"
        onClick={() => setIsMobileSidebarOpen(false)}
      />
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        onOpenSettings={() => {
          setIsMobileSidebarOpen(false);
          setIsSettingsOpen(true);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
      />
      <div className="mobile-topbar">
        <button
          type="button"
          className="mobile-topbar-icon"
          aria-label="Open conversations"
          onClick={() => setIsMobileSidebarOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <div className="mobile-topbar-brand">CHAT A.I+</div>
        <div className="mobile-topbar-actions">
          <button type="button" className="mobile-topbar-pill" onClick={handleNewChat}>
            <span className="mobile-topbar-pill-plus">+</span>
            <span>New</span>
          </button>
          <button
            type="button"
            className="mobile-topbar-icon"
            aria-label="Open settings"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Icon name="settings" />
          </button>
        </div>
      </div>
      <ChatWindow
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        streamingStartedAt={streamingStartedAt}
        errorMessage={errorMessage}
        currentModelLabel={selectedModelOption?.label ?? selectedModel}
        onSend={handleSend}
        onOpenModelPicker={() => setIsSettingsOpen(true)}
      />
      <SettingsDrawer
        isOpen={isSettingsOpen}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        selectedOption={selectedModelOption}
        onModelChange={setSelectedModel}
        reasoningLevel={reasoningLevel}
        onReasoningLevelChange={setReasoningLevel}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
