import { useMemo } from 'react';
import { Spin, Alert, Descriptions, Typography, Empty, Tag } from 'antd';
import { LoadingOutlined, InfoCircleOutlined } from '@ant-design/icons';

interface DebugResultsTabProps {
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
}

export default function DebugResultsTab({ result, isDebugging }: DebugResultsTabProps) {
  const displayContent = useMemo(() => {
    if (!result) return null;
    if (result.error) return null;
    return result.rawJson || JSON.stringify({
      conversation_id: result.conversationId,
      content: result.content,
      memory_info: result.memoryInfo,
    }, null, 2);
  }, [result]);

  if (isDebugging) {
    return (
      <div style={{ padding: 16 }}>
        <Spin indicator={<LoadingOutlined spin />} tip="正在调试...">
          {result?.content && (
            <Typography.Paragraph style={{ marginTop: 16 }}>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                {result.content}
              </pre>
            </Typography.Paragraph>
          )}
        </Spin>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          image={<InfoCircleOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
          description="请配置参数并发起调试"
        />
      </div>
    );
  }

  if (result.error) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="请求失败"
          description={
            <>
              <div>状态码: {result.status}</div>
              <div>{result.error}</div>
              <div>耗时: {result.responseTimeMs}ms</div>
            </>
          }
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Descriptions
        bordered
        size="small"
        column={4}
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="会话 ID">
          {result.conversationId ? (
            <Typography.Text copyable style={{ fontSize: 12 }}>{result.conversationId}</Typography.Text>
          ) : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="耗时">{result.responseTimeMs}ms</Descriptions.Item>
        <Descriptions.Item label="输入 Tokens">{result.promptTokens ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="输出 Tokens">{result.completionTokens ?? '-'}</Descriptions.Item>
      </Descriptions>

      {result.memoryInfo && (
        <Descriptions
          bordered
          size="small"
          column={4}
          style={{ marginBottom: 16 }}
        >
          <Descriptions.Item label="记忆注入">
            <Tag color={result.memoryInfo.enabled ? 'green' : 'default'}>
              {result.memoryInfo.enabled ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="作用域">{result.memoryInfo.scope}</Descriptions.Item>
          <Descriptions.Item label="记忆数量">{result.memoryInfo.count}</Descriptions.Item>
          <Descriptions.Item label="记忆 IDs">
            {result.memoryInfo.memory_ids.length > 0
              ? `${result.memoryInfo.memory_ids.length} 条`
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Typography.Title level={5} style={{ marginBottom: 8 }}>响应内容</Typography.Title>
      <div style={{
        background: '#f5f5f5',
        padding: 12,
        borderRadius: 6,
        marginBottom: 16,
        maxHeight: 200,
        overflow: 'auto',
        fontSize: 13,
        whiteSpace: 'pre-wrap',
      }}>
        {result.content || '(无内容)'}
      </div>

      <Typography.Title level={5} style={{ marginBottom: 8 }}>响应结果 (JSON)</Typography.Title>
      <pre style={{
        background: '#f5f5f5',
        padding: 12,
        borderRadius: 6,
        overflow: 'auto',
        maxHeight: 400,
        fontSize: 13,
      }}>
        {displayContent}
      </pre>
    </div>
  );
}