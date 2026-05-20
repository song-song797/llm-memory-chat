import { Select, Input, Button, Space, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { DebugMessage } from '../../types';

interface MessagesEditorProps {
  messages: DebugMessage[];
  onChange: (messages: DebugMessage[]) => void;
}

export default function MessagesEditor({ messages, onChange }: MessagesEditorProps) {
  const handleAddMessage = () => {
    onChange([...messages, { role: 'user', content: '' }]);
  };

  const handleDeleteMessage = (index: number) => {
    const newMessages = messages.filter((_, i) => i !== index);
    onChange(newMessages);
  };

  const handleMessageRoleChange = (index: number, role: DebugMessage['role']) => {
    const newMessages = messages.map((msg, i) =>
      i === index ? { ...msg, role } : msg
    );
    onChange(newMessages);
  };

  const handleMessageContentChange = (index: number, content: string) => {
    const newMessages = messages.map((msg, i) =>
      i === index ? { ...msg, content } : msg
    );
    onChange(newMessages);
  };

  const handleMoveMessage = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= messages.length) return;

    const newMessages = [...messages];
    [newMessages[index], newMessages[newIndex]] = [newMessages[newIndex], newMessages[index]];
    onChange(newMessages);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map((message, index) => (
        <Card
          key={index}
          size="small"
          styles={{
            body: { padding: '8px 12px' },
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Select
              value={message.role}
              onChange={(value) => handleMessageRoleChange(index, value)}
              style={{ width: 120 }}
              options={[
                { value: 'system', label: 'system' },
                { value: 'user', label: 'user' },
                { value: 'assistant', label: 'assistant' },
              ]}
            />
            <Space size="small">
              <Button
                icon={<ArrowUpOutlined />}
                size="small"
                disabled={index === 0}
                onClick={() => handleMoveMessage(index, 'up')}
              />
              <Button
                icon={<ArrowDownOutlined />}
                size="small"
                disabled={index === messages.length - 1}
                onClick={() => handleMoveMessage(index, 'down')}
              />
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => handleDeleteMessage(index)}
              />
            </Space>
          </div>
          <Input.TextArea
            value={message.content}
            onChange={(e) => handleMessageContentChange(index, e.target.value)}
            placeholder="输入消息内容..."
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </Card>
      ))}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddMessage}
        block
      >
        添加消息
      </Button>
    </div>
  );
}