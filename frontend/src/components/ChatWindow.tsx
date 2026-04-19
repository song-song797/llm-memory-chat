import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';
import ChatInput from './ChatInput';
import Icon from './Icons';

interface ChatWindowProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  streamingStartedAt: number | null;
  errorMessage: string;
  currentModelLabel: string;
  onSend: (message: string) => void;
  onOpenModelPicker: () => void;
}

const featureStacks = [
  {
    title: 'Explore',
    body: 'Learn how to use chat.ai platform for your needs',
    icon: 'globe' as const,
  },
  {
    title: 'Capabilities',
    body: 'How much capable chat.ai to full-fill your needs',
    icon: 'lightning' as const,
  },
  {
    title: 'Limitation',
    body: 'How much capable chat.ai to full-fill your needs',
    icon: 'warning' as const,
  },
];

const featureCards = [
  {
    title: '"Explain"',
    body: 'Quantum computing in simple terms',
  },
  {
    title: '"How to"',
    body: 'Make a search engine platform like google',
  },
  {
    title: '"Remember"',
    body: 'quantum computing in simple terms',
  },
  {
    title: '"Allows"',
    body: 'User to provide follow-up corrections',
  },
  {
    title: '"May"',
    body: 'Occasionally generate incorrect information',
  },
  {
    title: '"Limited"',
    body: 'Knowledge of world and events after 2021',
  },
];

const WELCOME_TITLE = 'Good day! How may I assist you today?';

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  );
}

export default function ChatWindow({
  messages,
  streamingContent,
  isStreaming,
  streamingStartedAt,
  errorMessage,
  currentModelLabel,
  onSend,
  onOpenModelPicker,
}: ChatWindowProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [typedWelcomeTitle, setTypedWelcomeTitle] = useState('');

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

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

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - streamingStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isStreaming, streamingStartedAt]);

  const showEmpty = messages.length === 0 && !isStreaming;

  useEffect(() => {
    if (!showEmpty) {
      setTypedWelcomeTitle(WELCOME_TITLE);
      return;
    }

    setTypedWelcomeTitle('');

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedWelcomeTitle(WELCOME_TITLE.slice(0, index));

      if (index >= WELCOME_TITLE.length) {
        window.clearInterval(timer);
      }
    }, 48);

    return () => window.clearInterval(timer);
  }, [showEmpty]);

  return (
    <main className="chat-stage">
      <button
        type="button"
        className="chat-model-trigger"
        aria-label={`Current model ${currentModelLabel}`}
        onClick={onOpenModelPicker}
      >
        <span>{currentModelLabel}</span>
        <Icon name="arrow-down" />
      </button>

      {errorMessage && <div className="stage-error-banner">{errorMessage}</div>}

      {showEmpty ? (
        <section className="welcome-stage">
          <div className="welcome-scroll">
            <h1>
              <span
                className={`welcome-typewriter ${
                  typedWelcomeTitle === WELCOME_TITLE ? 'is-complete' : ''
                }`}
              >
                {typedWelcomeTitle}
              </span>
            </h1>

            <div className="welcome-grid">
              <div className="welcome-stack">
                {featureStacks.map((stack) => (
                  <div key={stack.title} className="welcome-stack-row">
                    <div className="welcome-stack-card">
                      <span className="welcome-stack-icon">
                        <Icon name={stack.icon} />
                      </span>
                      <strong>{stack.title}</strong>
                      <p>{stack.body}</p>
                    </div>
                    <div className="welcome-stack-divider">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ))}
              </div>

              <div className="welcome-card-grid">
                {featureCards.map((card) => (
                  <div key={card.title} className="welcome-card">
                    <div className="welcome-card-copy">
                      <strong>{card.title}</strong>
                      <p>{card.body}</p>
                    </div>
                    <span className="welcome-card-arrow">
                      <Icon name="arrow-right" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chat-composer-dock">
            <ChatInput onSend={onSend} disabled={false} />
          </div>
        </section>
      ) : (
        <div className="thread-shell">
          <div className="thread-scroll" ref={messagesRef}>
            <div className="thread-inner">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`thread-entry ${message.role === 'assistant' ? 'is-assistant' : 'is-user'}`}
                >
                  {message.role === 'user' && (
                    <div className="thread-head is-user">
                      <div className="thread-userline is-user">
                        <span className="thread-prompt thread-prompt--user">{message.content}</span>
                      </div>
                    </div>
                  )}

                  {message.role === 'assistant' && (
                    <div className="thread-answer-card">
                      <div className="thread-label-row">
                        <span className="thread-brand-label">CHAT A.I+</span>
                        <span className="thread-brand-badge" />
                      </div>
                      <div className="thread-answer-body">
                        <MarkdownMessage content={message.content} />
                      </div>
                      <div className="thread-answer-footer">
                        <div className="thread-actions">
                          <button
                            type="button"
                            className="thread-action-pill"
                            aria-label="Copy answer"
                            onClick={() => void handleCopy(message.content)}
                          >
                            <Icon name="copy" />
                          </button>
                          <button
                            type="button"
                            className="thread-action-pill"
                            aria-label="Refresh answer"
                          >
                            <Icon name="refresh" />
                          </button>
                          <button
                            type="button"
                            className="thread-action-pill"
                            aria-label="Read answer aloud"
                          >
                            <Icon name="volume-loud" />
                          </button>
                          <button type="button" className="thread-action-pill" aria-label="Like answer">
                            <Icon name="thumb" />
                          </button>
                          <button
                            type="button"
                            className="thread-action-pill"
                            aria-label="Dislike answer"
                          >
                            <Icon name="thumb-down" />
                          </button>
                          <button type="button" className="thread-action-pill" aria-label="Share answer">
                            <Icon name="share" />
                          </button>
                          <button type="button" className="thread-action-pill" aria-label="More actions">
                            <Icon name="more-1" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ))}

              {isStreaming && (
                <article className="thread-entry is-assistant">
                  <div className="thread-head">
                    <div className="thread-userline">
                      <span className="thread-avatar assistant">AI</span>
                      <span className="thread-prompt">Generating a response...</span>
                    </div>
                  </div>
                  <div className="thread-answer-card">
                    <div className="thread-label-row">
                      <span className="thread-brand-label">CHAT A.I+</span>
                      <span className="thread-brand-badge" />
                    </div>
                    <div className="thread-answer-body">
                      {!streamingContent && (
                        <span className="thread-streaming-hint">
                          Thinking...
                          {elapsedSeconds > 0 ? ` ${elapsedSeconds}s` : ''}
                        </span>
                      )}
                      {streamingContent && <MarkdownMessage content={streamingContent} />}
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>
          <div className="chat-composer-dock">
            <ChatInput onSend={onSend} disabled={isStreaming} />
          </div>
        </div>
      )}
    </main>
  );
}
