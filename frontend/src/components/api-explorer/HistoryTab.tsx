import { List, Button, Popconfirm, Typography, Empty, Space, Tag } from 'antd';
import { HistoryOutlined, DeleteOutlined, DeleteFilled } from '@ant-design/icons';
import type { DebugHistoryEntry } from '../../types';

interface HistoryTabProps {
  history: DebugHistoryEntry[];
  onLoadFromHistory: (entry: DebugHistoryEntry) => void;
  onDeleteHistoryEntry: (entryId: string) => void;
  onClearHistory: () => void;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateMessages(messagesJson: string, maxLength = 50): string {
  try {
    const messages = JSON.parse(messagesJson);
    if (!Array.isArray(messages)) return messagesJson;

    const preview = messages
      .slice(0, 2)
      .map((msg: { role: string; content: string }) =>
        `${msg.role}: ${msg.content.slice(0, maxLength)}${msg.content.length > maxLength ? '...' : ''}`
      )
      .join(' | ');

    return messages.length > 2
      ? `${preview} ... (+${messages.length - 2}条)`
      : preview;
  } catch {
    return messagesJson.slice(0, maxLength);
  }
}

export default function HistoryTab({
  history,
  onLoadFromHistory,
  onDeleteHistoryEntry,
  onClearHistory,
}: HistoryTabProps) {
  if (history.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          image={<HistoryOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
          description="暂无调试历史"
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Text type="secondary">共 {history.length} 条记录</Typography.Text>
        <Popconfirm
          title="确定清空所有历史记录？"
          onConfirm={onClearHistory}
          okText="确定"
          cancelText="取消"
        >
          <Button icon={<DeleteFilled />} danger size="small">
            清空历史
          </Button>
        </Popconfirm>
      </div>

      <List
        dataSource={history}
        renderItem={(entry) => (
          <List.Item
            style={{ cursor: 'pointer' }}
            onClick={() => onLoadFromHistory(entry)}
            actions={[
              <Popconfirm
                key="delete"
                title="确定删除此记录？"
                onConfirm={() => onDeleteHistoryEntry(entry.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button icon={<DeleteOutlined />} danger size="small" type="text" />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={<Typography.Text strong>{entry.model}</Typography.Text>}
              description={
                <Space direction="vertical" size="small">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {truncateMessages(entry.messages)}
                  </Typography.Text>
                  <Space size="small">
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatTimestamp(entry.created_at)}
                    </Typography.Text>
                    <Tag color={entry.response_status === 200 ? 'success' : 'error'}>
                      {entry.response_status === 200 ? '成功' : '失败'}
                    </Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {entry.response_time_ms}ms
                    </Typography.Text>
                    {entry.total_tokens && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {entry.total_tokens} tokens
                      </Typography.Text>
                    )}
                  </Space>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
}