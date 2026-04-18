import { useEffect, useRef, useState } from 'react';
import type { Message, ModelOption, ReasoningLevel } from '../types';
import ChatInput from './ChatInput';

interface ChatWindowProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  streamingStartedAt: number | null;
  errorMessage: string;
  modelOptions: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  reasoningLevel: ReasoningLevel;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
  onSend: (message: string) => void;
}

function parseApiDate(iso: string): Date {
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasTimezone ? iso : `${iso}Z`);
}

function formatTime(iso: string): string {
  const d = parseApiDate(iso);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatWindow({
  messages,
  streamingContent,
  isStreaming,
  streamingStartedAt,
  errorMessage,
  modelOptions,
  selectedModel,
  onModelChange,
  reasoningLevel,
  onReasoningLevelChange,
  onSend,
}: ChatWindowProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: isStreaming ? 'auto' : 'smooth',
    });
  }, [messages, streamingContent, isStreaming]);

  useEffect(() => {
    if (!isStreaming || !streamingStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - streamingStartedAt) / 1000)));
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, streamingStartedAt]);

  const showEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="main-area">
      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      {showEmpty ? (
        <div className="empty-state">
          <div className="empty-icon">AI</div>
          <h2>{'\u4f60\u597d\uff0c\u5f00\u59cb\u804a\u70b9\u4ec0\u4e48\uff1f'}</h2>
          <p>
            {
              '\u4f60\u53ef\u4ee5\u76f4\u63a5\u63d0\u95ee\u3001\u8ba9\u5b83\u6574\u7406\u5185\u5bb9\uff0c\u6216\u8005\u57fa\u4e8e\u5386\u53f2\u5bf9\u8bdd\u7ee7\u7eed\u8ffd\u95ee\u3002'
            }
          </p>
        </div>
      ) : (
        <div className="chat-messages" id="chat-messages" ref={messagesRef}>
          <div className="messages-container">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '\u4f60' : 'AI'}
                </div>
                <div>
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">{formatTime(msg.created_at)}</div>
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="message assistant">
                <div className="message-avatar">AI</div>
                <div>
                  <div className="message-content">
                    {streamingContent || (
                      <div className="streaming-status">
                        <div className="typing-indicator">
                          <span className="dot" />
                          <span className="dot" />
                          <span className="dot" />
                        </div>
                        <div className="streaming-hint">
                          {'\u6b63\u5728\u751f\u6210\u4e2d...'}
                          {elapsedSeconds > 0
                            ? ` \u5df2\u7b49\u5f85 ${elapsedSeconds}s`
                            : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ChatInput
        onSend={onSend}
        disabled={isStreaming}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        reasoningLevel={reasoningLevel}
        onReasoningLevelChange={onReasoningLevelChange}
      />
    </div>
  );
}
