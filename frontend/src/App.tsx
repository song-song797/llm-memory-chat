import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './App.css';
import ChatWindow from './components/ChatWindow';
import Icon from './components/Icons';
import AccountSettingsPanel from './components/settings/AccountSettingsPanel';
import DataSettingsPanel from './components/settings/DataSettingsPanel';
import GeneralSettingsPanel, {
  type SettingsTheme,
} from './components/settings/GeneralSettingsPanel';
import MemorySettingsPanel from './components/settings/MemorySettingsPanel';
import SettingsCenter, { type SettingsSectionId } from './components/settings/SettingsCenter';
import Sidebar from './components/Sidebar';
import SignUpScreen from './components/SignUpScreen';
import { message as toast } from './services/message';
import * as api from './services/api';
import type {
  ComposerAttachment,
  Conversation,
  Memory,
  MemoryCandidate,
  MemoryDocument,
  MemoryScope,
  Message,
  ModelOption,
  Project,
  ReasoningLevel,
  User,
} from './types';

const MODEL_STORAGE_KEY = 'memory-chat:selected-model';
const REASONING_STORAGE_KEY = 'memory-chat:reasoning-level';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'memory-chat:sidebar-collapsed';
const VIEW_STORAGE_KEY = 'memory-chat:active-view';
const AUTH_TOKEN_STORAGE_KEY = 'memory-chat:auth-token';
const SETTINGS_SECTION_STORAGE_KEY = 'memory-chat:settings-section';
const THEME_STORAGE_KEY = 'memory-chat:theme';
const ACTIVE_CONVERSATION_KEY = 'memory-chat:active-conversation';
const INLINE_CANDIDATE_POLL_DELAYS = [1000, 3000, 6000, 10000] as const;

type AppView = 'signup' | 'chat';

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

function normalizeTheme(value: string | null): SettingsTheme {
  switch (value) {
    case 'rose':
    case 'butter':
    case 'mist':
    case 'mint':
    case 'neutral':
      return value;
    default:
      return 'neutral';
  }
}

function toTempMessageAttachments(attachments: ComposerAttachment[]) {
  return attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    mime_type: attachment.mime_type,
    kind: attachment.kind,
    size_bytes: attachment.size_bytes,
    content_url: attachment.preview_url ?? URL.createObjectURL(attachment.file),
  }));
}

function revokeAttachmentUrls(attachments: Message['attachments'] | undefined) {
  const urls = new Set(
    (attachments ?? [])
      .map((attachment) => attachment.content_url)
      .filter((url) => url.startsWith('blob:'))
  );

  urls.forEach((url) => {
    URL.revokeObjectURL(url);
  });
}

function getMemoryScope(memory: Memory): MemoryScope {
  if (memory.scope) return memory.scope;
  if (memory.conversation_id) return 'conversation';
  if (memory.project_id) return 'project';
  return 'global';
}

function dedupeMemoryCandidates(candidates: MemoryCandidate[]): MemoryCandidate[] {
  return Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values());
}

export default function App() {
  const [appView, setAppView] = useState<AppView>(() => {
    const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return storedView === 'chat' ? 'chat' : 'signup';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY) || null;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('off');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStartedAt, setStreamingStartedAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSettingsCenterOpen, setIsSettingsCenterOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>(() => {
    const storedSection = window.localStorage.getItem(SETTINGS_SECTION_STORAGE_KEY);
    if (
      storedSection === 'memory' ||
      storedSection === 'data' ||
      storedSection === 'account'
    ) {
      return storedSection;
    }
    return 'general';
  });
  const [selectedTheme, setSelectedTheme] = useState<SettingsTheme>(() =>
    normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  );
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [globalMemories, setGlobalMemories] = useState<Memory[]>([]);
  const [projectMemories, setProjectMemories] = useState<Memory[]>([]);
  const [conversationMemories, setConversationMemories] = useState<Memory[]>([]);
  const [globalMemoryDocument, setGlobalMemoryDocument] = useState<MemoryDocument | null>(null);
  const [projectMemoryDocument, setProjectMemoryDocument] = useState<MemoryDocument | null>(null);
  const [conversationMemoryDocument, setConversationMemoryDocument] = useState<MemoryDocument | null>(null);
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidate[]>([]);
  const [inlineCandidate, setInlineCandidate] = useState<MemoryCandidate | null>(null);
  const [globalMemoryDraft, setGlobalMemoryDraft] = useState('');
  const [projectMemoryDrafts, setProjectMemoryDrafts] = useState<Record<string, string>>({});
  const [conversationMemoryDrafts, setConversationMemoryDrafts] = useState<Record<string, string>>({});
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
  const [isMemoryMutating, setIsMemoryMutating] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isClearingConversations, setIsClearingConversations] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  });
  const [messageVersions, setMessageVersions] = useState<Record<string, { total: number; currentVersion: number }>>({});
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const activeUserId = currentUser?.id ?? null;
  const isMemorySettingsVisible = isSettingsCenterOpen && activeSettingsSection === 'memory';
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const memoryRequestSeqRef = useRef(0);
  const memoryMutationSeqRef = useRef(0);
  const inlineCandidateRequestSeqRef = useRef(0);
  const inlineCandidatePollTimersRef = useRef<number[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const activeConvIdRef = useRef<string | null>(null);
  const isMemorySettingsVisibleRef = useRef(false);

  const clearInlineCandidatePolls = useCallback(() => {
    inlineCandidatePollTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    inlineCandidatePollTimersRef.current = [];
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConvId) ?? null,
    [activeConvId, conversations]
  );
  const activeProjectId = activeConversation?.project_id ?? draftProjectId;
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects]
  );
  const activeProjectConversations = useMemo(
    () =>
      activeProjectId
        ? conversations.filter((conversation) => conversation.project_id === activeProjectId)
        : [],
    [activeProjectId, conversations]
  );
  const projectMemoryDraft = activeProjectId ? projectMemoryDrafts[activeProjectId] ?? '' : '';
  const conversationMemoryDraft = activeConvId ? conversationMemoryDrafts[activeConvId] ?? '' : '';

  const resetChatState = useCallback(() => {
    memoryRequestSeqRef.current += 1;
    memoryMutationSeqRef.current += 1;
    inlineCandidateRequestSeqRef.current += 1;
    clearInlineCandidatePolls();
    setConversations([]);
    setProjects([]);
    setDraftProjectId(null);
    setActiveConvId(null);
    setMessages([]);
    setStreamingContent('');
    setIsStreaming(false);
    setStreamingStartedAt(null);
    setErrorMessage('');
    setIsSettingsCenterOpen(false);
    setIsModelPickerOpen(false);
    setGlobalMemories([]);
    setProjectMemories([]);
    setConversationMemories([]);
    setGlobalMemoryDocument(null);
    setProjectMemoryDocument(null);
    setConversationMemoryDocument(null);
    setMemoryCandidates([]);
    setInlineCandidate(null);
    setGlobalMemoryDraft('');
    setProjectMemoryDrafts({});
    setConversationMemoryDrafts({});
    setIsMemoriesLoading(false);
    setIsMemoryMutating(false);
    setIsMobileSidebarOpen(false);
  }, [clearInlineCandidatePolls]);

  useEffect(() => {
    currentUserIdRef.current = activeUserId;
  }, [activeUserId]);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    isMemorySettingsVisibleRef.current = isMemorySettingsVisible;
    if (!isMemorySettingsVisible) {
      memoryRequestSeqRef.current += 1;
      setIsMemoriesLoading(false);
    }
  }, [isMemorySettingsVisible]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, activeSettingsSection);
  }, [activeSettingsSection]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  }, [selectedTheme]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (!storedToken) {
        api.setAuthToken(null);
        setAppView('signup');
        setIsAuthBootstrapping(false);
        return;
      }

      api.setAuthToken(storedToken);

      try {
        const user = await api.fetchCurrentUser();
        setCurrentUser(user);
        setAppView('chat');
      } catch (err) {
        console.error(err);
        api.setAuthToken(null);
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setCurrentUser(null);
        setAppView('signup');
      } finally {
        setIsAuthBootstrapping(false);
      }
    };

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    Promise.all([api.fetchConversations(), api.fetchProjects()])
      .then(([conversationData, projectData]) => {
        setConversations(conversationData);
        setProjects(projectData);
        setErrorMessage('');

        // Validate stored active conversation ID
        const storedConvId = activeConvIdRef.current;
        if (storedConvId && !conversationData.some((c) => c.id === storedConvId)) {
          window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
          setActiveConvId(null);
        }
      })
      .catch((err: Error) => {
        console.error(err);
        setErrorMessage(err.message);
      });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

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
  }, [currentUser]);

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
    if (activeConvId) {
      window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConvId);
    } else {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }
  }, [activeConvId]);

  useEffect(() => {
    if (!selectedModel || modelOptions.length === 0) return;

    const selectedOption =
      modelOptions.find((item) => item.id === selectedModel) ?? modelOptions[0] ?? null;
    setReasoningLevel((prev) => normalizeReasoningLevel(prev, selectedOption));
  }, [selectedModel, modelOptions]);

  const loadInlineCandidate = useCallback(async (conversationId: string | null, projectId: string | null) => {
    const userId = currentUserIdRef.current;
    if (!userId || !conversationId) {
      setInlineCandidate(null);
      return;
    }

    const requestSeq = inlineCandidateRequestSeqRef.current + 1;
    inlineCandidateRequestSeqRef.current = requestSeq;
    const isStale = () =>
      inlineCandidateRequestSeqRef.current !== requestSeq ||
      currentUserIdRef.current !== userId ||
      activeConvIdRef.current !== conversationId;

    try {
      const requests: Array<Promise<MemoryCandidate[]>> = [
        api.fetchMemoryCandidates({ status: 'pending', surface: 'inline', scope: 'global' }),
      ];
      if (projectId) {
        requests.push(
          api.fetchMemoryCandidates({
            status: 'pending',
            surface: 'inline',
            scope: 'project',
            projectId,
          })
        );
      }
      requests.push(
        api.fetchMemoryCandidates({
          status: 'pending',
          surface: 'inline',
          scope: 'conversation',
          conversationId,
        })
      );

      const results = await Promise.all(requests);
      if (isStale()) return;

      setInlineCandidate(dedupeMemoryCandidates(results.flat())[0] ?? null);
    } catch (err) {
      if (isStale()) return;

      console.error(err);
      setInlineCandidate(null);
    }
  }, []);

  const scheduleInlineCandidatePolls = useCallback(
    (conversationId: string, projectId: string | null) => {
      clearInlineCandidatePolls();

      INLINE_CANDIDATE_POLL_DELAYS.forEach((delay) => {
        const timerId = window.setTimeout(() => {
          inlineCandidatePollTimersRef.current = inlineCandidatePollTimersRef.current.filter(
            (currentTimerId) => currentTimerId !== timerId
          );
          void loadInlineCandidate(conversationId, projectId);
        }, delay);

        inlineCandidatePollTimersRef.current.push(timerId);
      });
    },
    [clearInlineCandidatePolls, loadInlineCandidate]
  );

  useEffect(() => {
    return () => {
      clearInlineCandidatePolls();
    };
  }, [clearInlineCandidatePolls]);

  useEffect(() => {
    if (!currentUser || !activeConvId) {
      clearInlineCandidatePolls();
      setMessages([]);
      setInlineCandidate(null);
      setIsMessagesLoading(false);
      return;
    }

    setIsMessagesLoading(true);
    api
      .fetchMessages(activeConvId)
      .then(async (data) => {
        setMessages(data);
        setErrorMessage('');
        void loadInlineCandidate(activeConvId, activeProjectId ?? null);

        // Load version info for assistant messages that have versions
        const assistantMessages = data.filter(
          (msg) => msg.role === 'assistant' && msg.parent_message_id
        );
        if (assistantMessages.length > 0) {
          const versionResults = await Promise.all(
            assistantMessages.map((msg) =>
              api.getMessageVersions(activeConvId, msg.id).catch(() => null)
            )
          );
          const newVersions: Record<string, { total: number; currentVersion: number }> = {};
          versionResults.forEach((result, index) => {
            if (result && result.total > 1) {
              const msg = assistantMessages[index];
              newVersions[msg.id] = {
                total: result.total,
                currentVersion: result.current_version,
              };
            }
          });
          setMessageVersions(newVersions);
        }
      })
      .catch((err: Error) => {
        console.error(err);
        setErrorMessage(err.message);
        // If conversation doesn't exist, clear it
        window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        setActiveConvId(null);
      })
      .finally(() => {
        setIsMessagesLoading(false);
      });
  }, [activeConvId, activeProjectId, clearInlineCandidatePolls, currentUser, loadInlineCandidate]);

  const refreshConversations = useCallback(async () => {
    const convs = await api.fetchConversations();
    setConversations(convs);
    setErrorMessage('');
  }, []);

  useEffect(() => {
    if (!activeUserId || !isMemorySettingsVisible) {
      return;
    }

    const requestSeq = memoryRequestSeqRef.current + 1;
    const userId = activeUserId;
    let isActive = true;
    memoryRequestSeqRef.current = requestSeq;

    const isStale = () =>
      !isActive ||
      memoryRequestSeqRef.current !== requestSeq ||
      currentUserIdRef.current !== userId ||
      !isMemorySettingsVisibleRef.current;

    void (async () => {
      await Promise.resolve();
      if (isStale()) return;

      setIsMemoriesLoading(true);
      try {
        const candidateRequests: Array<Promise<MemoryCandidate[]>> = [
          api.fetchMemoryCandidates({ status: 'pending', surface: 'settings', scope: 'global' }),
        ];
        if (activeProjectId) {
          candidateRequests.push(
            api.fetchMemoryCandidates({
              status: 'pending',
              surface: 'settings',
              scope: 'project',
              projectId: activeProjectId,
            })
          );
        }
        if (activeConvId) {
          candidateRequests.push(
            api.fetchMemoryCandidates({
              status: 'pending',
              surface: 'settings',
              scope: 'conversation',
              conversationId: activeConvId,
            })
          );
        }

        const [
          nextGlobalMemories,
          nextProjectMemories,
          nextConversationMemories,
          nextGlobalDocuments,
          nextProjectDocuments,
          nextConversationDocuments,
          nextCandidateGroups,
        ] = await Promise.all([
          api.fetchMemories({ scope: 'global' }),
          activeProjectId
            ? api.fetchMemories({ scope: 'project', projectId: activeProjectId })
            : Promise.resolve([]),
          activeConvId
            ? api.fetchMemories({ scope: 'conversation', conversationId: activeConvId })
            : Promise.resolve([]),
          api.fetchMemoryDocuments({ scope: 'global' }),
          activeProjectId
            ? api.fetchMemoryDocuments({ scope: 'project', projectId: activeProjectId })
            : Promise.resolve([]),
          activeConvId
            ? api.fetchMemoryDocuments({ scope: 'conversation', conversationId: activeConvId })
            : Promise.resolve([]),
          Promise.all(candidateRequests),
        ]);
        if (isStale()) return;

        setGlobalMemories(nextGlobalMemories);
        setProjectMemories(nextProjectMemories);
        setConversationMemories(nextConversationMemories);
        setGlobalMemoryDocument(nextGlobalDocuments[0] ?? null);
        setProjectMemoryDocument(nextProjectDocuments[0] ?? null);
        setConversationMemoryDocument(nextConversationDocuments[0] ?? null);
        setMemoryCandidates(dedupeMemoryCandidates(nextCandidateGroups.flat()));
        setErrorMessage('');
      } catch (err) {
        if (isStale()) return;

        console.error(err);
        const nextError = err instanceof Error ? err.message : 'Failed to fetch memories';
        setErrorMessage(nextError);
        toast.error({
          content: nextError,
          placement: 'top',
        });
      } finally {
        if (!isStale()) {
          setIsMemoriesLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
      memoryRequestSeqRef.current += 1;
    };
  }, [activeConvId, activeProjectId, activeUserId, isMemorySettingsVisible]);

  const handleAuthSubmit = useCallback(
    async (mode: 'signup' | 'login', email: string, password: string) => {
      setIsAuthenticating(true);
      setAuthErrorMessage('');

      try {
        const response =
          mode === 'signup'
            ? await api.register(email, password)
            : await api.login(email, password);

        api.setAuthToken(response.token);
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
        setCurrentUser(response.user);
        setAppView('chat');
        setErrorMessage('');
        setAuthErrorMessage('');
        toast.success({
          content: mode === 'signup' ? 'Account created successfully' : 'Welcome back',
          placement: 'top',
        });
      } catch (err) {
        console.error(err);
        setAuthErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
        throw err;
      } finally {
        setIsAuthenticating(false);
      }
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error(err);
    } finally {
      streamAbortControllerRef.current?.abort();
      api.setAuthToken(null);
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setCurrentUser(null);
      setAuthErrorMessage('');
      resetChatState();
      setAppView('signup');
      toast.success({
        content: 'Signed out',
        placement: 'top',
      });
    }
  }, [resetChatState]);

  const handleNewChat = useCallback(() => {
    inlineCandidateRequestSeqRef.current += 1;
    clearInlineCandidatePolls();
    setAppView('chat');
    setActiveConvId(null);
    setDraftProjectId(null);
    setMessages([]);
    setStreamingContent('');
    setIsModelPickerOpen(false);
    setInlineCandidate(null);
    setErrorMessage('');
    setIsMobileSidebarOpen(false);
  }, [clearInlineCandidatePolls]);

  const handleNewProjectChat = useCallback((projectId: string) => {
    inlineCandidateRequestSeqRef.current += 1;
    clearInlineCandidatePolls();
    setAppView('chat');
    setActiveConvId(null);
    setDraftProjectId(projectId);
    setMessages([]);
    setStreamingContent('');
    setIsModelPickerOpen(false);
    setInlineCandidate(null);
    setErrorMessage('');
    setIsMobileSidebarOpen(false);
  }, [clearInlineCandidatePolls]);

  const handleSelectConversation = useCallback((id: string) => {
    inlineCandidateRequestSeqRef.current += 1;
    clearInlineCandidatePolls();
    setAppView('chat');
    setActiveConvId(id);
    setDraftProjectId(null);
    setStreamingContent('');
    setIsModelPickerOpen(false);
    setInlineCandidate(null);
    setErrorMessage('');
    setIsMobileSidebarOpen(false);
  }, [clearInlineCandidatePolls]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        if (activeConvId === id) {
          inlineCandidateRequestSeqRef.current += 1;
          clearInlineCandidatePolls();
          setActiveConvId(null);
          setMessages([]);
          setInlineCandidate(null);
        }
        setIsMobileSidebarOpen(false);
        await refreshConversations();
      } catch (err) {
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete conversation');
      }
    },
    [activeConvId, clearInlineCandidatePolls, refreshConversations]
  );

  const handleRenameConversation = useCallback(
    async (id: string, nextTitle: string) => {
      if (!nextTitle) {
        toast.warning({
          content: '会话名称不能为空',
          placement: 'top',
        });
        return;
      }

      try {
        await api.updateConversation(id, { title: nextTitle });
        await refreshConversations();
        toast.success({
          content: '会话已重命名',
          placement: 'top',
        });
      } catch (err) {
        console.error(err);
        const nextError =
          err instanceof Error ? err.message : 'Failed to rename conversation';
        setErrorMessage(nextError);
        toast.error({
          content: nextError,
          placement: 'top',
        });
      }
    },
    [refreshConversations]
  );

  const handleTogglePinConversation = useCallback(
    async (id: string, pinned: boolean) => {
      try {
        await api.updateConversation(id, { pinned: !pinned });
        await refreshConversations();
        toast.success({
          content: pinned ? '已取消置顶' : '已置顶会话',
          placement: 'top',
        });
      } catch (err) {
        console.error(err);
        const nextError =
          err instanceof Error ? err.message : 'Failed to update conversation';
        setErrorMessage(nextError);
        toast.error({
          content: nextError,
          placement: 'top',
        });
      }
    },
    [refreshConversations]
  );

  const handleClearAllConversations = useCallback(async () => {
    if (isClearingConversations) return;

    setIsClearingConversations(true);
    try {
      await api.clearAllConversations();
      inlineCandidateRequestSeqRef.current += 1;
      clearInlineCandidatePolls();
      setConversations([]);
      setActiveConvId(null);
      setDraftProjectId(null);
      setMessages([]);
      setStreamingContent('');
      setInlineCandidate(null);
      setErrorMessage('');
      setIsMobileSidebarOpen(false);
      toast.success({
        content: 'All conversations cleared',
        placement: 'top',
      });
    } catch (err) {
      console.error(err);
      const nextError =
        err instanceof Error ? err.message : 'Failed to clear conversations';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      setIsClearingConversations(false);
    }
  }, [clearInlineCandidatePolls, isClearingConversations]);

  const handleCreateGlobalMemory = useCallback(async () => {
    const content = globalMemoryDraft.trim();
    const userId = activeUserId;
    if (!content || !userId || isMemoryMutating) return;

    const mutationSeq = memoryMutationSeqRef.current + 1;
    memoryMutationSeqRef.current = mutationSeq;
    const isStale = () =>
      memoryMutationSeqRef.current !== mutationSeq || currentUserIdRef.current !== userId;

    setIsMemoryMutating(true);
    try {
      const memory = await api.createMemory({ content, scope: 'global' });
      if (isStale()) return;

      setGlobalMemories((prev) => [memory, ...prev]);
      setGlobalMemoryDraft('');
      setErrorMessage('');
      toast.success({
        content: '记忆已添加',
        placement: 'top',
      });
    } catch (err) {
      if (isStale()) return;

      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to create memory';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      if (!isStale()) {
        setIsMemoryMutating(false);
      }
    }
  }, [activeUserId, globalMemoryDraft, isMemoryMutating]);

  const handleCreateProjectMemory = useCallback(async () => {
    const content = projectMemoryDraft.trim();
    const userId = activeUserId;
    const projectId = activeProjectId;
    if (!content || !userId || !projectId || isMemoryMutating) return;

    const mutationSeq = memoryMutationSeqRef.current + 1;
    memoryMutationSeqRef.current = mutationSeq;
    const isStale = () =>
      memoryMutationSeqRef.current !== mutationSeq ||
      currentUserIdRef.current !== userId ||
      activeProjectId !== projectId;

    setIsMemoryMutating(true);
    try {
      const memory = await api.createMemory({
        content,
        scope: 'project',
        projectId,
      });
      if (isStale()) return;

      setProjectMemories((prev) => [memory, ...prev]);
      setProjectMemoryDrafts((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      setErrorMessage('');
      toast.success({
        content: '记忆已添加',
        placement: 'top',
      });
    } catch (err) {
      if (isStale()) return;

      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to create memory';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      if (!isStale()) {
        setIsMemoryMutating(false);
      }
    }
  }, [activeProjectId, activeUserId, isMemoryMutating, projectMemoryDraft]);

  const handleProjectMemoryDraftChange = useCallback((value: string) => {
    const projectId = activeProjectId;
    if (!projectId) return;

    setProjectMemoryDrafts((prev) => ({
      ...prev,
      [projectId]: value,
    }));
  }, [activeProjectId]);

  const handleCreateConversationMemory = useCallback(async () => {
    const content = conversationMemoryDraft.trim();
    const userId = activeUserId;
    const conversationId = activeConvId;
    if (!content || !userId || !conversationId || isMemoryMutating) return;

    const mutationSeq = memoryMutationSeqRef.current + 1;
    memoryMutationSeqRef.current = mutationSeq;
    const isStale = () =>
      memoryMutationSeqRef.current !== mutationSeq ||
      currentUserIdRef.current !== userId ||
      activeConvIdRef.current !== conversationId;

    setIsMemoryMutating(true);
    try {
      const memory = await api.createMemory({
        content,
        scope: 'conversation',
        projectId: activeProjectId ?? null,
        conversationId,
      });
      if (isStale()) return;

      setConversationMemories((prev) => [memory, ...prev]);
      setConversationMemoryDrafts((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setErrorMessage('');
      toast.success({
        content: '记忆已添加',
        placement: 'top',
      });
    } catch (err) {
      if (isStale()) return;

      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to create memory';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      if (!isStale()) {
        setIsMemoryMutating(false);
      }
    }
  }, [
    activeConvId,
    activeProjectId,
    activeUserId,
    conversationMemoryDraft,
    isMemoryMutating,
  ]);

  const handleConversationMemoryDraftChange = useCallback((value: string) => {
    const conversationId = activeConvId;
    if (!conversationId) return;

    setConversationMemoryDrafts((prev) => ({
      ...prev,
      [conversationId]: value,
    }));
  }, [activeConvId]);

  const handleToggleMemory = useCallback(async (memory: Memory) => {
    const userId = activeUserId;
    if (!userId || isMemoryMutating) return;
    const memoryScope = getMemoryScope(memory);

    const mutationSeq = memoryMutationSeqRef.current + 1;
    memoryMutationSeqRef.current = mutationSeq;
    const isStale = () =>
      memoryMutationSeqRef.current !== mutationSeq || currentUserIdRef.current !== userId;

    setIsMemoryMutating(true);
    try {
      const updatedMemory = await api.updateMemory(memory.id, {
        enabled: !memory.enabled,
      });
      if (isStale()) return;

      if (memoryScope === 'conversation') {
        setConversationMemories((prev) =>
          prev.map((item) => (item.id === updatedMemory.id ? updatedMemory : item))
        );
      } else if (memoryScope === 'project') {
        setProjectMemories((prev) =>
          prev.map((item) => (item.id === updatedMemory.id ? updatedMemory : item))
        );
      } else {
        setGlobalMemories((prev) =>
          prev.map((item) => (item.id === updatedMemory.id ? updatedMemory : item))
        );
      }
      setErrorMessage('');
      toast.success({
        content: updatedMemory.enabled ? '记忆已启用' : '记忆已停用',
        placement: 'top',
      });
    } catch (err) {
      if (isStale()) return;

      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to update memory';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      if (!isStale()) {
        setIsMemoryMutating(false);
      }
    }
  }, [activeUserId, isMemoryMutating]);

  const handleDeleteMemory = useCallback(async (memory: Memory) => {
    const userId = activeUserId;
    if (!userId || isMemoryMutating) return;
    const memoryScope = getMemoryScope(memory);

    const mutationSeq = memoryMutationSeqRef.current + 1;
    memoryMutationSeqRef.current = mutationSeq;
    const isStale = () =>
      memoryMutationSeqRef.current !== mutationSeq || currentUserIdRef.current !== userId;

    setIsMemoryMutating(true);
    try {
      await api.deleteMemory(memory.id);
      if (isStale()) return;

      if (memoryScope === 'conversation') {
        setConversationMemories((prev) => prev.filter((item) => item.id !== memory.id));
      } else if (memoryScope === 'project') {
        setProjectMemories((prev) => prev.filter((item) => item.id !== memory.id));
      } else {
        setGlobalMemories((prev) => prev.filter((item) => item.id !== memory.id));
      }
      setErrorMessage('');
      toast.success({
        content: '记忆已删除',
        placement: 'top',
      });
    } catch (err) {
      if (isStale()) return;

      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to delete memory';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      if (!isStale()) {
        setIsMemoryMutating(false);
      }
    }
  }, [activeUserId, isMemoryMutating]);

  const upsertMemory = useCallback((memory: Memory) => {
    const memoryScope = getMemoryScope(memory);
    const upsert = (items: Memory[]) =>
      items.some((item) => item.id === memory.id)
        ? items.map((item) => (item.id === memory.id ? memory : item))
        : [memory, ...items];

    if (memoryScope === 'conversation') {
      setConversationMemories(upsert);
    } else if (memoryScope === 'project') {
      setProjectMemories(upsert);
    } else {
      setGlobalMemories(upsert);
    }
  }, []);

  const removeMemoryFromLists = useCallback((memoryId: string) => {
    setGlobalMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
    setProjectMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
    setConversationMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
  }, []);

  const removeCandidate = useCallback((candidateId: string) => {
    setMemoryCandidates((prev) => prev.filter((candidate) => candidate.id !== candidateId));
    setInlineCandidate((current) => (current?.id === candidateId ? null : current));
  }, []);

  const handleAcceptMemoryCandidate = useCallback(async (candidate: MemoryCandidate) => {
    const userId = activeUserId;
    if (!userId || isMemoryMutating) return;

    setIsMemoryMutating(true);
    try {
      const result = await api.acceptMemoryCandidate(candidate.id);
      if (result.archived_memory_id) {
        removeMemoryFromLists(result.archived_memory_id);
      }
      if (result.memory) {
        upsertMemory(result.memory);
      }
      removeCandidate(candidate.id);
      setErrorMessage('');
      toast.success({
        content: '建议记忆已保存',
        placement: 'top',
      });
    } catch (err) {
      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to accept memory candidate';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      setIsMemoryMutating(false);
    }
  }, [activeUserId, isMemoryMutating, removeCandidate, removeMemoryFromLists, upsertMemory]);

  const handleDismissMemoryCandidate = useCallback(async (candidate: MemoryCandidate) => {
    const userId = activeUserId;
    if (!userId || isMemoryMutating) return;

    setIsMemoryMutating(true);
    try {
      await api.dismissMemoryCandidate(candidate.id);
      removeCandidate(candidate.id);
      setErrorMessage('');
      toast.success({
        content: '建议记忆已忽略',
        placement: 'top',
      });
    } catch (err) {
      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to dismiss memory candidate';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      setIsMemoryMutating(false);
    }
  }, [activeUserId, isMemoryMutating, removeCandidate]);

  const handleDeferMemoryCandidate = useCallback(async (candidate: MemoryCandidate) => {
    const userId = activeUserId;
    if (!userId || isMemoryMutating) return;

    setIsMemoryMutating(true);
    try {
      const deferredCandidate = await api.deferMemoryCandidate(candidate.id);
      const settingsCandidate = deferredCandidate ?? candidate;
      setInlineCandidate((current) => (current?.id === candidate.id ? null : current));
      setMemoryCandidates((prev) =>
        dedupeMemoryCandidates([{ ...settingsCandidate, surface: 'settings' }, ...prev])
      );
      setErrorMessage('');
      toast.success({
        content: '已移到稍后处理',
        placement: 'top',
      });
    } catch (err) {
      console.error(err);
      const nextError = err instanceof Error ? err.message : 'Failed to defer memory candidate';
      setErrorMessage(nextError);
      toast.error({
        content: nextError,
        placement: 'top',
      });
    } finally {
      setIsMemoryMutating(false);
    }
  }, [activeUserId, isMemoryMutating]);

  const handleCreateProject = useCallback(
    async (name: string) => {
      const project = await api.createProject({ name });
      setProjects((prev) => [project, ...prev]);
      handleNewProjectChat(project.id);
    },
    [handleNewProjectChat]
  );

  const handleUpdateProject = useCallback(
    async (projectId: string, updates: { name?: string; archived?: boolean }) => {
      const updatedProject = await api.updateProject(projectId, updates);
      setProjects((prev) =>
        updates.archived
          ? prev.filter((project) => project.id !== projectId)
          : prev.map((project) => (project.id === projectId ? updatedProject : project))
      );
      if (updates.archived && activeProjectId === projectId) {
        handleNewChat();
      }
    },
    [activeProjectId, handleNewChat]
  );

  const handleSend = useCallback(
    async ({
      message,
      attachments,
    }: {
      message: string;
      attachments: ComposerAttachment[];
    }) => {
      if (isStreaming) return;

      setAppView('chat');
      const tempAttachments = toTempMessageAttachments(attachments);

      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
        attachments: tempAttachments,
      };

      setMessages((prev) => [...prev, tempUserMsg]);
      setIsStreaming(true);
      setStreamingStartedAt(Date.now());
      setStreamingContent('');
      setErrorMessage('');
      stopRequestedRef.current = false;
      const abortController = new AbortController();
      streamAbortControllerRef.current = abortController;

      let currentConvId = activeConvId;
      const currentProjectId = activeProjectId ?? null;
      let sendFailed = false;

      try {
        await api.sendMessage(
          message,
          attachments.map((attachment) => attachment.file),
          currentConvId,
          currentProjectId,
          selectedModel || null,
          reasoningLevel,
          (chunk) => {
            setStreamingContent((prev) => prev + chunk);
          },
          (id) => {
            currentConvId = id;
            activeConvIdRef.current = id;
            setActiveConvId(id);
          },
          (error) => {
            sendFailed = true;
            setErrorMessage(error);
            console.error('Stream error:', error);
          },
          abortController.signal
        );
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError' && stopRequestedRef.current)) {
          sendFailed = true;
          setErrorMessage(err instanceof Error ? err.message : 'Failed to send message');
          console.error(err);
        }
      } finally {
        streamAbortControllerRef.current = null;
        stopRequestedRef.current = false;
        setIsStreaming(false);
        setStreamingStartedAt(null);
        setStreamingContent('');
        revokeAttachmentUrls(tempUserMsg.attachments);

        if (currentConvId) {
          try {
            const refreshedConversationId = currentConvId;
            const [msgs] = await Promise.all([
              api.fetchMessages(refreshedConversationId),
              refreshConversations(),
            ]);
            setMessages(msgs);
            setDraftProjectId(null);
            scheduleInlineCandidatePolls(refreshedConversationId, currentProjectId);
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
    [
      activeConvId,
      activeProjectId,
      isStreaming,
      reasoningLevel,
      refreshConversations,
      scheduleInlineCandidatePolls,
      selectedModel,
    ]
  );

  const handleStopStreaming = useCallback(() => {
    if (!streamAbortControllerRef.current) return;
    stopRequestedRef.current = true;
    streamAbortControllerRef.current.abort();
  }, []);

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (isStreaming || !activeConvId) return;

      setIsStreaming(true);
      setStreamingStartedAt(Date.now());
      setStreamingContent('');
      setErrorMessage('');
      setRegeneratingMessageId(messageId);
      stopRequestedRef.current = false;
      const abortController = new AbortController();
      streamAbortControllerRef.current = abortController;

      try {
        await api.regenerateMessage(
          activeConvId,
          messageId,
          {
            model: selectedModel || null,
            reasoningLevel,
          },
          (chunk) => {
            setStreamingContent((prev) => prev + chunk);
          },
          (id) => {
            activeConvIdRef.current = id;
            setActiveConvId(id);
          },
          (error) => {
            setErrorMessage(error);
            console.error('Regenerate error:', error);
          },
          abortController.signal
        );
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError' && stopRequestedRef.current)) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to regenerate message');
          console.error(err);
        }
      } finally {
        streamAbortControllerRef.current = null;
        stopRequestedRef.current = false;
        setIsStreaming(false);
        setStreamingStartedAt(null);
        setStreamingContent('');
        setRegeneratingMessageId(null);

        if (activeConvId) {
          try {
            const [msgs, versions] = await Promise.all([
              api.fetchMessages(activeConvId),
              api.getMessageVersions(activeConvId, messageId),
            ]);
            setMessages(msgs);
            // Find the current version's message ID (new message after regeneration has different ID)
            const currentVersion = versions.versions.find((v) => v.is_current);
            const currentMessageId = currentVersion?.id ?? messageId;
            setMessageVersions((prev) => ({
              ...prev,
              [currentMessageId]: {
                total: versions.total,
                currentVersion: versions.current_version,
              },
            }));
          } catch (err) {
            console.error(err);
            setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh conversation');
          }
        }
      }
    },
    [activeConvId, isStreaming, reasoningLevel, selectedModel]
  );

  const handleSwitchVersion = useCallback(
    async (messageId: string, versionNumber: number) => {
      if (!activeConvId) return;

      try {
        const updatedMessage = await api.switchMessageVersion(activeConvId, messageId, versionNumber);
        // When switching versions, the message ID changes (each version has different ID)
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? updatedMessage : msg))
        );
        // Move version info from old ID key to new ID key
        setMessageVersions((prev) => {
          const oldInfo = prev[messageId];
          const total = oldInfo?.total ?? 1;
          const newState = { ...prev };
          delete newState[messageId];
          newState[updatedMessage.id] = {
            total,
            currentVersion: versionNumber,
          };
          return newState;
        });
      } catch (err) {
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to switch version');
      }
    },
    [activeConvId]
  );

  const handleToggleModelPicker = useCallback(() => {
    setIsModelPickerOpen((prev) => !prev);
  }, []);

  const handleCloseModelPicker = useCallback(() => {
    setIsModelPickerOpen(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsModelPickerOpen(false);
    setIsSettingsCenterOpen(true);
  }, []);

  const currentTheme = selectedTheme;

  const selectedModelOption = useMemo(
    () =>
      modelOptions.find((option) => option.id === selectedModel) ?? modelOptions[0] ?? null,
    [modelOptions, selectedModel]
  );

  if (isAuthBootstrapping) {
    return <div className="auth-loading-screen">Loading...</div>;
  }

  if (!currentUser || appView === 'signup') {
    return (
      <SignUpScreen
        onSubmit={handleAuthSubmit}
        isSubmitting={isAuthenticating}
        errorMessage={authErrorMessage}
      />
    );
  }

  const settingsCenterPanels: Record<SettingsSectionId, ReactNode> = {
    general: (
      <GeneralSettingsPanel
        selectedTheme={selectedTheme}
        onThemeChange={setSelectedTheme}
      />
    ),
    memory: (
      <MemorySettingsPanel
        activeProjectName={activeProject?.name ?? null}
        activeConversationId={activeConvId}
        globalMemories={globalMemories}
        projectMemories={projectMemories}
        conversationMemories={conversationMemories}
        globalMemoryDocument={globalMemoryDocument}
        projectMemoryDocument={projectMemoryDocument}
        conversationMemoryDocument={conversationMemoryDocument}
        globalMemoryDraft={globalMemoryDraft}
        projectMemoryDraft={projectMemoryDraft}
        conversationMemoryDraft={conversationMemoryDraft}
        memoryCandidates={memoryCandidates}
        isMemoriesLoading={isMemoriesLoading}
        isMemoryMutating={isMemoryMutating}
        onGlobalMemoryDraftChange={setGlobalMemoryDraft}
        onProjectMemoryDraftChange={handleProjectMemoryDraftChange}
        onConversationMemoryDraftChange={handleConversationMemoryDraftChange}
        onCreateGlobalMemory={handleCreateGlobalMemory}
        onCreateProjectMemory={handleCreateProjectMemory}
        onCreateConversationMemory={handleCreateConversationMemory}
        onToggleMemory={handleToggleMemory}
        onDeleteMemory={handleDeleteMemory}
        onAcceptMemoryCandidate={handleAcceptMemoryCandidate}
        onDismissMemoryCandidate={handleDismissMemoryCandidate}
      />
    ),
    data: (
      <DataSettingsPanel
        key={conversations.length > 0 && !isClearingConversations ? 'can-clear' : 'clear-disabled'}
        hasConversations={conversations.length > 0}
        isClearingAll={isClearingConversations}
        onClearAllConversations={handleClearAllConversations}
      />
    ),
    account: <AccountSettingsPanel currentUser={currentUser} onLogout={handleLogout} />,
  };

  return (
    <div
      className={`app-shell theme-${currentTheme} ${
        isSidebarCollapsed ? 'is-sidebar-collapsed' : ''
      }`}
    >
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
        onRename={handleRenameConversation}
        onTogglePin={handleTogglePinConversation}
        onClearAll={handleClearAllConversations}
        onOpenSettings={() => {
          setIsMobileSidebarOpen(false);
          handleOpenSettings();
        }}
        onLogout={handleLogout}
        currentUser={currentUser}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
        isClearingAll={isClearingConversations}
        projects={projects}
        activeProjectId={activeProjectId ?? null}
        onNewProject={handleCreateProject}
        onNewProjectChat={handleNewProjectChat}
        onRenameProject={(projectId, name) => handleUpdateProject(projectId, { name })}
        onArchiveProject={(projectId) => handleUpdateProject(projectId, { archived: true })}
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
            onClick={handleOpenSettings}
          >
            <Icon name="settings" />
          </button>
        </div>
      </div>
      <ChatWindow
        conversationId={activeConvId}
        messages={messages}
        activeProjectName={activeProject?.name ?? null}
        projectConversations={activeProjectConversations}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        streamingStartedAt={streamingStartedAt}
        errorMessage={errorMessage}
        currentModelLabel={selectedModelOption?.label ?? selectedModel}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        selectedModelOption={selectedModelOption}
        reasoningLevel={reasoningLevel}
        isModelPickerOpen={isModelPickerOpen}
        inlineCandidate={inlineCandidate}
        isMemoryMutating={isMemoryMutating}
        isMessagesLoading={isMessagesLoading}
        onSend={handleSend}
        onStopStreaming={handleStopStreaming}
        onToggleModelPicker={handleToggleModelPicker}
        onCloseModelPicker={handleCloseModelPicker}
        onModelChange={setSelectedModel}
        onReasoningLevelChange={setReasoningLevel}
        onSelectConversation={handleSelectConversation}
        onAcceptInlineCandidate={handleAcceptMemoryCandidate}
        onDeferInlineCandidate={handleDeferMemoryCandidate}
        onDismissInlineCandidate={handleDismissMemoryCandidate}
        onRegenerate={handleRegenerate}
        onSwitchVersion={handleSwitchVersion}
        messageVersions={messageVersions}
        regeneratingMessageId={regeneratingMessageId}
      />
      <SettingsCenter
        isOpen={isSettingsCenterOpen}
        activeSection={activeSettingsSection}
        onSectionChange={setActiveSettingsSection}
        onClose={() => setIsSettingsCenterOpen(false)}
        panels={settingsCenterPanels}
      />
    </div>
  );
}
