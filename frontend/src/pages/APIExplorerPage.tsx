import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout, Button, Typography, Spin, Result } from 'antd';
import { ArrowLeftOutlined, LoadingOutlined } from '@ant-design/icons';
import { message as toast } from '../services/message';
import * as api from '../services/api';
import type {
  ChatApiParams,
  DebugHistoryEntry,
  ModelOption,
  User,
} from '../types';
import ParamsPanel from '../components/api-explorer/ParamsPanel';
import TabPanel from '../components/api-explorer/TabPanel';
import ActionBar from '../components/api-explorer/ActionBar';

const AUTH_TOKEN_STORAGE_KEY = 'memory-chat:auth-token';

interface DebugResult {
  content: string;
  rawJson: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  responseTimeMs: number;
  status: number;
  error?: string | null;
  memoryInfo?: {
    enabled: boolean;
    scope: string;
    count: number;
    memory_ids: string[];
  } | null;
  conversationId?: string | null;
}

function getDefaultParams(models: ModelOption[]): ChatApiParams {
  const defaultModel = models[0]?.id || '';
  return {
    endpoint: '/chat',
    conversation_id: null,
    project_id: null,
    message: '天空为什么是蓝色的？',
    model: defaultModel,
    reasoning_level: 'off',
    mode: null,
    memory: {
      memory_enabled: true,
      memory_limit: null,
      memory_scope: 'all',
      include_memory_info: false,
    },
  };
}

export default function APIExplorerPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [params, setParams] = useState<ChatApiParams | null>(null);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  const [history, setHistory] = useState<DebugHistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'result' | 'sdk' | 'history' | 'docs'>('result');

  // Bootstrap auth
  useEffect(() => {
    const bootstrapAuth = async () => {
      const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (!storedToken) {
        api.setAuthToken(null);
        setIsAuthLoading(false);
        return;
      }

      api.setAuthToken(storedToken);

      try {
        const user = await api.fetchCurrentUser();
        setCurrentUser(user);
      } catch (err) {
        console.error(err);
        api.setAuthToken(null);
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  // Fetch models and history after auth
  useEffect(() => {
    if (!currentUser) return;

    Promise.all([api.fetchModels(), api.fetchDebugHistory(50, 0)])
      .then(([catalog, historyData]) => {
        setModelOptions(catalog.models);
        setHistory(historyData);
        setParams(getDefaultParams(catalog.models));
      })
      .catch((err) => {
        console.error(err);
        toast.error('加载数据失败');
      });
  }, [currentUser]);

  // Build request payload based on endpoint
  const buildRequestPayload = (p: ChatApiParams): object => {
    const basePayload = {
      model: p.model,
      reasoning_level: p.reasoning_level,
    };

    switch (p.endpoint) {
      case '/chat':
        return {
          ...basePayload,
          conversation_id: p.conversation_id,
          project_id: p.project_id,
          message: p.message,
          mode: p.mode,
        };

      case '/v1/chat':
        return {
          ...basePayload,
          conversation_id: p.conversation_id,
          project_id: p.project_id,
          message: p.message,
          mode: p.mode,
          memory: p.memory,
        };

      case '/v1/chat/auto':
        return {
          ...basePayload,
          conversation_id: p.conversation_id,
          project_id: p.project_id,
          message: p.message,
          mode: p.mode,
        };

      case '/v1/chat/simple':
        return {
          ...basePayload,
          conversation_id: p.conversation_id,
          message: p.message,
          mode: p.mode,
        };

      default:
        return basePayload;
    }
  };

  // Handle debug request
  const handleDebug = useCallback(async () => {
    if (!params || !currentUser) return;

    // Validate params for /v1/chat/simple
    if (params.endpoint === '/v1/chat/simple' && !params.conversation_id) {
      toast.error('/api/v1/chat/simple 需要提供 conversation_id');
      return;
    }

    if (!params.message.trim()) {
      toast.error('消息内容不能为空');
      return;
    }

    setIsDebugging(true);
    setResult(null);

    const startTime = Date.now();
    let accumulatedContent = '';
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let totalTokens: number | null = null;
    let conversationId: string | null = null;
    let memoryInfo: DebugResult['memoryInfo'] = null;

    try {
      const requestPayload = buildRequestPayload(params);
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

      const res = await fetch(`${apiBase}${params.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`,
        },
        body: JSON.stringify(requestPayload),
      });

      const responseTimeMs = Date.now() - startTime;

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = '请求失败';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        setResult({
          content: '',
          rawJson: '',
          responseTimeMs,
          status: res.status,
          error: errorMessage,
        });

        // Save to history
        await api.createDebugHistory({
          model: params.model,
          messages: JSON.stringify([{ role: 'user', content: params.message }]),
          max_tokens: 0,
          stream: true,
          include_usage: false,
          thinking_enabled: false,
          reasoning_level: params.reasoning_level,
          response_status: res.status,
          response_time_ms: responseTimeMs,
          error_message: errorMessage,
        });

        return;
      }

      // Handle SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
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

          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            // Handle conversation_id
            if (parsed.conversation_id) {
              conversationId = parsed.conversation_id;
            }

            // Handle memory_info (for /api/v1/chat)
            if (parsed.memory_info) {
              memoryInfo = parsed.memory_info;
            }

            // Handle content
            if (parsed.content) {
              accumulatedContent += parsed.content;
              setResult({
                content: accumulatedContent,
                rawJson: '',
                promptTokens,
                completionTokens,
                totalTokens,
                responseTimeMs: Date.now() - startTime,
                status: 200,
                memoryInfo,
                conversationId,
              });
            }

            // Handle error
            if (parsed.error) {
              setResult({
                content: accumulatedContent,
                rawJson: '',
                responseTimeMs: Date.now() - startTime,
                status: 200,
                error: parsed.error,
                memoryInfo,
                conversationId,
              });
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Final result
      setResult({
        content: accumulatedContent,
        rawJson: JSON.stringify({
          conversation_id: conversationId,
          content: accumulatedContent,
          memory_info: memoryInfo,
        }, null, 2),
        promptTokens,
        completionTokens,
        totalTokens,
        responseTimeMs: Date.now() - startTime,
        status: 200,
        memoryInfo,
        conversationId,
      });

      // Save to history
      await api.createDebugHistory({
        model: params.model,
        messages: JSON.stringify([{ role: 'user', content: params.message }]),
        max_tokens: 0,
        stream: true,
        include_usage: false,
        thinking_enabled: false,
        reasoning_level: params.reasoning_level,
        response_status: 200,
        response_time_ms: responseTimeMs,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      });

      // Refresh history
      const newHistory = await api.fetchDebugHistory(50, 0);
      setHistory(newHistory);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setResult({
        content: '',
        rawJson: '',
        responseTimeMs: Date.now() - startTime,
        status: 0,
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsDebugging(false);
    }
  }, [params, currentUser]);

  const handleClearParams = useCallback(() => {
    if (modelOptions.length > 0) {
      setParams(getDefaultParams(modelOptions));
    }
    setResult(null);
  }, [modelOptions]);

  const handleLoadFromHistory = useCallback((entry: DebugHistoryEntry) => {
    try {
      const messages = JSON.parse(entry.messages);
      const userMessage = messages.find((m: { role: string }) => m.role === 'user');

      setParams({
        endpoint: '/chat',
        conversation_id: null,
        project_id: null,
        message: userMessage?.content || '',
        model: entry.model,
        reasoning_level: (entry.reasoning_level as 'off' | 'standard' | 'deep') || 'off',
        mode: null,
        memory: {
          memory_enabled: true,
          memory_limit: null,
          memory_scope: 'all',
          include_memory_info: false,
        },
      });
      setActiveTab('result');
    } catch {
      toast.error('加载历史记录失败');
    }
  }, []);

  const handleDeleteHistoryEntry = useCallback(async (entryId: string) => {
    try {
      await api.deleteDebugHistoryEntry(entryId);
      setHistory(history.filter((entry) => entry.id !== entryId));
      toast.success('删除成功');
    } catch {
      toast.error('删除失败');
    }
  }, [history]);

  const handleClearHistory = useCallback(async () => {
    try {
      await api.clearDebugHistory();
      setHistory([]);
      toast.success('清空成功');
    } catch {
      toast.error('清空失败');
    }
  }, []);

  if (isAuthLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin indicator={<LoadingOutlined spin />} tip="加载中..." />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="warning"
          title="请先登录以使用 API Explorer"
          extra={
            <Link to="/">
              <Button type="primary">返回主页</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <Layout.Header style={{
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: 56,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button icon={<ArrowLeftOutlined />} type="text">返回</Button>
        </Link>
        <Typography.Title level={4} style={{ margin: 0 }}>Chat API Explorer</Typography.Title>
        <Typography.Text type="secondary">{currentUser.email}</Typography.Text>
      </Layout.Header>

      {/* Body */}
      <Layout style={{ flex: 1 }}>
        {/* Left Panel - Params */}
        <Layout.Sider width={400} style={{ background: '#fff', borderRight: '1px solid #e8e8e8', position: 'relative' }}>
          <ParamsPanel
            params={params}
            modelOptions={modelOptions}
            onChange={setParams}
          />
          <ActionBar
            onDebug={handleDebug}
            onClear={handleClearParams}
            isDebugging={isDebugging}
          />
        </Layout.Sider>

        {/* Right Panel - Tabs */}
        <Layout.Content style={{ background: '#fff' }}>
          <TabPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            params={params}
            result={result}
            isDebugging={isDebugging}
            history={history}
            onLoadFromHistory={handleLoadFromHistory}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
            onClearHistory={handleClearHistory}
          />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}