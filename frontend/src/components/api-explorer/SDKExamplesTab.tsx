import { useState } from 'react';
import { Tabs, Button, Empty, Typography } from 'antd';
import { CopyOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { ChatApiParams } from '../../types';

interface SDKExamplesTabProps {
  params: ChatApiParams | null;
}

function escapeShellString(str: string): string {
  return str.replace(/'/g, "'\\''");
}

const endpointDescriptions: Record<string, string> = {
  '/chat': '主聊天接口，自动记忆注入 + 会话保存',
  '/v1/chat': '可配置记忆注入，支持自定义 scope/limit',
  '/v1/chat/auto': '自动记忆注入，无需配置',
  '/v1/chat/simple': '纯对话接口，无记忆注入',
};

export default function SDKExamplesTab({ params }: SDKExamplesTabProps) {
  const [activeLanguage, setActiveLanguage] = useState<'curl' | 'python' | 'javascript'>('curl');

  if (!params) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          image={<InfoCircleOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
          description="请先配置参数"
        />
      </div>
    );
  }

  const buildPayload = (): object => {
    const base = {
      model: params.model,
      reasoning_level: params.reasoning_level,
    };

    switch (params.endpoint) {
      case '/chat':
        return {
          ...base,
          conversation_id: params.conversation_id,
          project_id: params.project_id,
          message: params.message,
          mode: params.mode,
        };

      case '/v1/chat':
        return {
          ...base,
          conversation_id: params.conversation_id,
          project_id: params.project_id,
          message: params.message,
          mode: params.mode,
          memory: params.memory,
        };

      case '/v1/chat/auto':
        return {
          ...base,
          conversation_id: params.conversation_id,
          project_id: params.project_id,
          message: params.message,
          mode: params.mode,
        };

      case '/v1/chat/simple':
        return {
          ...base,
          conversation_id: params.conversation_id,
          message: params.message,
          mode: params.mode,
        };

      default:
        return base;
    }
  };

  const generateCurlCode = (): string => {
    const payload = buildPayload();
    const jsonPayload = JSON.stringify(payload, null, 2);
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

    return `curl -X POST '${apiBase}${params.endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '${escapeShellString(jsonPayload)}'`;
  };

  const generatePythonCode = (): string => {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
    const payload = buildPayload();
    const payloadJson = JSON.stringify(payload, null, 4);

    return `import requests

url = "${apiBase}${params.endpoint}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN"
}
payload = ${payloadJson.replace(/"/g, '"').replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}

response = requests.post(url, headers=headers, json=payload, stream=True)

for line in response.iter_lines():
    if line:
        decoded = line.decode('utf-8')
        if decoded.startswith('data: '):
            data = decoded[6:]
            if data == '[DONE]':
                break
            print(data)`;
  };

  const generateJavaScriptCode = (): string => {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
    const payload = buildPayload();
    const payloadJson = JSON.stringify(payload, null, 2);
    const isStream = params.endpoint.startsWith('/v1/') ? params.stream : true;

    if (!isStream) {
      return `const response = await fetch('${apiBase}${params.endpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(${payloadJson})
});

const result = await response.json();
console.log(result.content);`;
    }

    return `const response = await fetch('${apiBase}${params.endpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(${payloadJson})
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      console.log(JSON.parse(data));
    }
  }
}`;
  };

  const codeMap = {
    curl: generateCurlCode(),
    python: generatePythonCode(),
    javascript: generateJavaScriptCode(),
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeMap[activeLanguage]);
    } catch {
      // Handle error silently
    }
  };

  const tabItems = [
    {
      key: 'curl',
      label: 'cURL',
      children: (
        <div style={{ position: 'relative' }}>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={handleCopy}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            复制
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            {endpointDescriptions[params.endpoint] || ''}
          </Typography.Text>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 400,
            fontSize: 13,
            paddingRight: 80,
          }}>
            {codeMap.curl}
          </pre>
        </div>
      ),
    },
    {
      key: 'python',
      label: 'Python',
      children: (
        <div style={{ position: 'relative' }}>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={handleCopy}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            复制
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            {endpointDescriptions[params.endpoint] || ''}
          </Typography.Text>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 400,
            fontSize: 13,
            paddingRight: 80,
          }}>
            {codeMap.python}
          </pre>
        </div>
      ),
    },
    {
      key: 'javascript',
      label: 'JavaScript',
      children: (
        <div style={{ position: 'relative' }}>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={handleCopy}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            复制
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            {endpointDescriptions[params.endpoint] || ''}
          </Typography.Text>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 400,
            fontSize: 13,
            paddingRight: 80,
          }}>
            {codeMap.javascript}
          </pre>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Tabs
        activeKey={activeLanguage}
        onChange={(key) => setActiveLanguage(key as 'curl' | 'python' | 'javascript')}
        items={tabItems}
      />
    </div>
  );
}