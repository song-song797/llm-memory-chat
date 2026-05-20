import { Tabs } from 'antd';
import type { ChatApiParams, DebugHistoryEntry } from '../../types';
import DebugResultsTab from './DebugResultsTab';
import SDKExamplesTab from './SDKExamplesTab';
import HistoryTab from './HistoryTab';
import DocsTab from './DocsTab';

interface TabPanelProps {
  activeTab: 'result' | 'sdk' | 'history' | 'docs';
  onTabChange: (tab: 'result' | 'sdk' | 'history' | 'docs') => void;
  params: ChatApiParams | null;
  result: {
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
  } | null;
  isDebugging: boolean;
  history: DebugHistoryEntry[];
  onLoadFromHistory: (entry: DebugHistoryEntry) => void;
  onDeleteHistoryEntry: (entryId: string) => void;
  onClearHistory: () => void;
}

export default function TabPanel({
  activeTab,
  onTabChange,
  params,
  result,
  isDebugging,
  history,
  onLoadFromHistory,
  onDeleteHistoryEntry,
  onClearHistory,
}: TabPanelProps) {
  const items = [
    {
      key: 'result',
      label: '调试结果',
      children: <DebugResultsTab result={result} isDebugging={isDebugging} />,
    },
    {
      key: 'sdk',
      label: 'SDK示例',
      children: <SDKExamplesTab params={params} />,
    },
    {
      key: 'history',
      label: '调用历史',
      children: (
        <HistoryTab
          history={history}
          onLoadFromHistory={onLoadFromHistory}
          onDeleteHistoryEntry={onDeleteHistoryEntry}
          onClearHistory={onClearHistory}
        />
      ),
    },
    {
      key: 'docs',
      label: '文档说明',
      children: <DocsTab />,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => onTabChange(key as 'result' | 'sdk' | 'history' | 'docs')}
        items={items.map(item => ({
          ...item,
          children: <div style={{ padding: 16, overflow: 'auto', height: 'calc(100vh - 56px - 46px)' }}>{item.children}</div>
        }))}
        style={{ padding: '0 16px' }}
      />
    </div>
  );
}