import { Typography, Descriptions, Divider, List, Card } from 'antd';

export default function DocsTab() {
  return (
    <div style={{ padding: 16, maxWidth: 800 }}>
      <Typography.Title level={4}>Chat Completions API 参数说明</Typography.Title>

      <Divider />

      <Typography.Title level={5}>请求参数</Typography.Title>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="model">
            <Typography.Text code>string</Typography.Text> (必填)
            <br />
            要使用的模型 ID。可在模型选择器中查看可用模型列表。
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="messages">
            <Typography.Text code>array</Typography.Text> (必填)
            <br />
            对话消息列表，每条消息包含 role 和 content 字段。
          </Descriptions.Item>
        </Descriptions>
        <List
          size="small"
          dataSource={[
            { role: 'system', desc: '系统指令，设定模型行为' },
            { role: 'user', desc: '用户输入消息' },
            { role: 'assistant', desc: '模型之前的回复' },
          ]}
          renderItem={(item) => (
            <List.Item>
              <Typography.Text strong>{item.role}</Typography.Text>: {item.desc}
            </List.Item>
          )}
        />
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="max_tokens">
            <Typography.Text code>integer</Typography.Text> (可选)
            <br />
            生成的最大 Token 数量。不设置则模型会生成直到自然结束或达到模型限制。
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="stream">
            <Typography.Text code>boolean</Typography.Text> (可选，默认 true)
            <br />
            是否以流式方式返回响应。开启时逐块返回内容，适合实时展示。
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="stream_options.include_usage">
            <Typography.Text code>boolean</Typography.Text> (可选)
            <br />
            流式响应中是否包含 Token 使用统计信息。
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="thinking">
            <Typography.Text code>object</Typography.Text> (可选)
            <br />
            推理模式配置，部分模型支持。设置 type 为 "enabled" 开启推理模式。
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      <Typography.Title level={5}>响应格式</Typography.Title>

      <Card size="small">
        <Typography.Paragraph>响应为 JSON 格式，包含以下字段：</Typography.Paragraph>
        <pre style={{
          background: '#f5f5f5',
          padding: 12,
          borderRadius: 6,
          overflow: 'auto',
          fontSize: 13,
        }}>
{`{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "回复内容..."
    }
  }],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 32,
    "total_tokens": 47
  }
}`}
        </pre>
      </Card>

      <Divider />

      <Typography.Title level={5}>注意事项</Typography.Title>

      <List
        size="small"
        dataSource={[
          '流式响应时，Token 统计会在最后一个 chunk 中返回',
          '推理模式消耗更多 Token，适用于复杂任务',
          '建议设置合理的 max_tokens 避免过长输出',
          'system 消息通常放在 messages 数组开头',
        ]}
        renderItem={(item) => (
          <List.Item>
            {item}
          </List.Item>
        )}
      />
    </div>
  );
}