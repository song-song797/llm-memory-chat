import { Collapse, Select, Input, Switch, Typography, InputNumber } from 'antd';
import type { ChatApiParams, ModelOption, ApiEndpoint, MemoryInjectionScope, ReasoningLevel } from '../../types';

interface ParamsPanelProps {
  params: ChatApiParams | null;
  modelOptions: ModelOption[];
  onChange: (params: ChatApiParams) => void;
}

const panelStyle = {
  marginBottom: 8,
  borderRadius: 8,
};

const endpointOptions: { value: ApiEndpoint; label: string; description: string }[] = [
  { value: '/chat', label: '/api/chat', description: '主聊天接口，自动记忆注入' },
  { value: '/v1/chat', label: '/api/v1/chat', description: '可配置记忆注入' },
  { value: '/v1/chat/auto', label: '/api/v1/chat/auto', description: '自动记忆注入' },
  { value: '/v1/chat/simple', label: '/api/v1/chat/simple', description: '纯对话，无记忆注入' },
];

const memoryScopeOptions: { value: MemoryInjectionScope; label: string }[] = [
  { value: 'global', label: 'global - 全局记忆' },
  { value: 'project', label: 'project - 项目记忆' },
  { value: 'conversation', label: 'conversation - 会话记忆' },
  { value: 'all', label: 'all - 所有作用域' },
];

const reasoningLevelOptions: { value: ReasoningLevel; label: string }[] = [
  { value: 'off', label: 'off - 关闭推理' },
  { value: 'standard', label: 'standard - 标准推理' },
  { value: 'deep', label: 'deep - 深度推理' },
];

export default function ParamsPanel({ params, modelOptions, onChange }: ParamsPanelProps) {
  if (!params) {
    return (
      <div style={{ padding: 16 }}>
        <Typography.Text type="secondary">加载参数...</Typography.Text>
      </div>
    );
  }

  const handleEndpointChange = (endpoint: ApiEndpoint) => {
    // Reset relevant params when endpoint changes
    const newParams: ChatApiParams = {
      ...params,
      endpoint,
      // /v1/chat/simple requires conversation_id
      conversation_id: endpoint === '/v1/chat/simple' ? params.conversation_id || '' : params.conversation_id,
    };
    onChange(newParams);
  };

  const handleConversationIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...params, conversation_id: e.target.value || null });
  };

  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...params, project_id: e.target.value || null });
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...params, message: e.target.value });
  };

  const handleModelChange = (model: string) => {
    onChange({ ...params, model });
  };

  const handleReasoningLevelChange = (reasoning_level: ReasoningLevel) => {
    onChange({ ...params, reasoning_level });
  };

  const handleModeChange = (checked: boolean) => {
    onChange({ ...params, mode: checked ? 'think' : null });
  };

  // Memory config handlers (only for /api/v1/chat)
  const handleMemoryEnabledChange = (enabled: boolean) => {
    onChange({
      ...params,
      memory: { ...params.memory, memory_enabled: enabled },
    });
  };

  const handleMemoryLimitChange = (limit: number | null) => {
    onChange({
      ...params,
      memory: { ...params.memory, memory_limit: limit },
    });
  };

  const handleMemoryScopeChange = (scope: MemoryInjectionScope) => {
    onChange({
      ...params,
      memory: { ...params.memory, memory_scope: scope },
    });
  };

  const handleIncludeMemoryInfoChange = (include: boolean) => {
    onChange({
      ...params,
      memory: { ...params.memory, include_memory_info: include },
    });
  };

  const isSimpleEndpoint = params.endpoint === '/v1/chat/simple';
  const isV1ChatEndpoint = params.endpoint === '/v1/chat';

  const collapseItems = [
    {
      key: 'endpoint',
      label: 'API 端点',
      children: (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
            选择调试接口
          </Typography.Text>
          <Select
            value={params.endpoint}
            onChange={handleEndpointChange}
            style={{ width: '100%' }}
            options={endpointOptions}
            optionRender={(option) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Typography.Text strong>{option.data.label}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>{option.data.description}</Typography.Text>
              </div>
            )}
          />
        </div>
      ),
      style: panelStyle,
    },
    {
      key: 'conversation',
      label: 'conversation_id',
      children: (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
            {isSimpleEndpoint ? '会话 ID（必填）' : '会话 ID（可选，留空自动创建）'}
          </Typography.Text>
          <Input
            value={params.conversation_id || ''}
            onChange={handleConversationIdChange}
            placeholder={isSimpleEndpoint ? '请输入会话 ID' : '留空将创建新会话'}
            status={isSimpleEndpoint && !params.conversation_id ? 'error' : undefined}
          />
        </div>
      ),
      style: panelStyle,
    },
    ...(isSimpleEndpoint ? [] : [{
      key: 'project',
      label: 'project_id',
      children: (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
            项目 ID（可选）
          </Typography.Text>
          <Input
            value={params.project_id || ''}
            onChange={handleProjectIdChange}
            placeholder="留空表示无项目"
          />
        </div>
      ),
      style: panelStyle,
    }]),
    {
      key: 'message',
      label: 'message',
      children: (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
            用户消息内容
          </Typography.Text>
          <Input.TextArea
            value={params.message}
            onChange={handleMessageChange}
            rows={3}
            placeholder="输入消息内容..."
          />
        </div>
      ),
      style: panelStyle,
    },
    {
      key: 'model',
      label: 'model',
      children: (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
            选择模型
          </Typography.Text>
          <Select
            value={params.model}
            onChange={handleModelChange}
            style={{ width: '100%' }}
            options={modelOptions.map((m) => ({ value: m.id, label: m.label }))}
          />
        </div>
      ),
      style: panelStyle,
    },
    {
      key: 'reasoning',
      label: 'reasoning_level',
      children: (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
            推理强度
          </Typography.Text>
          <Select
            value={params.reasoning_level}
            onChange={handleReasoningLevelChange}
            style={{ width: '100%' }}
            options={reasoningLevelOptions}
          />
        </div>
      ),
      style: panelStyle,
    },
    {
      key: 'mode',
      label: 'mode',
      children: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Text>思考模式 (think)</Typography.Text>
          <Switch checked={params.mode === 'think'} onChange={handleModeChange} />
        </div>
      ),
      style: panelStyle,
    },
    ...(isV1ChatEndpoint ? [{
      key: 'memory',
      label: 'memory 配置',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography.Text>启用记忆注入 (memory_enabled)</Typography.Text>
            <Switch checked={params.memory.memory_enabled} onChange={handleMemoryEnabledChange} />
          </div>
          <div>
            <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              记忆数量上限 (memory_limit)
            </Typography.Text>
            <InputNumber
              value={params.memory.memory_limit}
              onChange={handleMemoryLimitChange}
              min={1}
              max={100}
              placeholder="默认自动"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <Typography.Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              记忆作用域 (memory_scope)
            </Typography.Text>
            <Select
              value={params.memory.memory_scope}
              onChange={handleMemoryScopeChange}
              style={{ width: '100%' }}
              options={memoryScopeOptions}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography.Text>返回记忆信息 (include_memory_info)</Typography.Text>
            <Switch checked={params.memory.include_memory_info} onChange={handleIncludeMemoryInfoChange} />
          </div>
        </div>
      ),
      style: panelStyle,
    }] : []),
  ];

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: 'calc(100% - 56px)' }}>
      <Collapse
        defaultActiveKey={['endpoint', 'conversation', 'message', 'model', 'reasoning']}
        items={collapseItems}
        bordered={false}
      />
    </div>
  );
}