import { useEffect, useRef, useState } from 'react';
import type { ModelOption, ReasoningLevel } from '../types';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  modelOptions: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  reasoningLevel: ReasoningLevel;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
}

function getLatencyLabel(latencyHint?: string | null): string {
  switch (latencyHint) {
    case 'fast':
      return '\u5feb';
    case 'balanced':
      return '\u5747\u8861';
    case 'slower':
      return '\u6162';
    default:
      return '\u53ef\u7528';
  }
}

function getReasoningOptions(option?: ModelOption | null): Array<{
  value: ReasoningLevel;
  label: string;
}> {
  switch (option?.reasoning_mode) {
    case 'toggle':
      return [
        { value: 'off', label: '\u76f4\u7b54' },
        { value: 'standard', label: '\u601d\u8003' },
      ];
    case 'budget':
      return [
        { value: 'off', label: '\u76f4\u7b54' },
        { value: 'standard', label: '\u6807\u51c6\u601d\u8003' },
        { value: 'deep', label: '\u6df1\u5165\u601d\u8003' },
      ];
    case 'always_budget':
      return [
        { value: 'standard', label: '\u6807\u51c6\u601d\u8003' },
        { value: 'deep', label: '\u6df1\u5165\u601d\u8003' },
      ];
    default:
      return [];
  }
}

function getReasoningNote(option?: ModelOption | null): string {
  switch (option?.reasoning_mode) {
    case 'toggle':
      return option.experimental_reasoning
        ? '\u5b9e\u9a8c\u6027\u63a5\u5165\uff1a\u5f53\u524d\u6a21\u578b\u53ea\u652f\u6301\u539f\u751f\u601d\u8003\u5f00\u5173\u3002'
        : '\u5f53\u524d\u6a21\u578b\u53ea\u652f\u6301\u539f\u751f\u601d\u8003\u5f00\u5173\uff0c\u4e0d\u652f\u6301\u6df1\u5ea6\u8c03\u8282\u3002';
    case 'budget':
      return option.experimental_reasoning
        ? '\u5b9e\u9a8c\u6027\u63a5\u5165\uff1a\u53ef\u4ee5\u5173\u95ed\u601d\u8003\u6216\u8c03\u8282\u601d\u8003\u6df1\u5ea6\uff0c\u884c\u4e3a\u53ef\u80fd\u968f\u7f51\u5173\u53d8\u5316\u3002'
        : '\u5f53\u524d\u6a21\u578b\u4f7f\u7528\u539f\u751f thinking_budget\uff0c\u53ef\u4ee5\u5173\u95ed\u601d\u8003\u6216\u8c03\u8282\u6df1\u5ea6\u3002';
    case 'always_budget':
      return '\u5b9e\u9a8c\u6027\u63a5\u5165\uff1a\u5f53\u524d\u6a21\u578b\u9ed8\u8ba4\u5f00\u542f\u539f\u751f\u601d\u8003\uff0c\u4ec5\u652f\u6301\u8c03\u8282\u601d\u8003\u6df1\u5ea6\u3002';
    default:
      return '\u5f53\u524d\u6a21\u578b\u6682\u65e0\u53ef\u7528\u7684\u539f\u751f\u601d\u8003\u53c2\u6570\u3002';
  }
}

export default function ChatInput({
  onSend,
  disabled,
  modelOptions,
  selectedModel,
  onModelChange,
  reasoningLevel,
  onReasoningLevelChange,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    modelOptions.find((option) => option.id === selectedModel) ?? modelOptions[0] ?? null;
  const reasoningOptions = getReasoningOptions(selectedOption);
  const reasoningNote = getReasoningNote(selectedOption);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModelMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (disabled || modelOptions.length === 0) {
      setIsModelMenuOpen(false);
    }
  }, [disabled, modelOptions.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-container">
        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'\u7ed9 AI \u53d1\u9001\u6d88\u606f'}
            disabled={disabled}
            rows={1}
          />

          <div className="composer-footer">
            <div className="composer-controls">
              <div
                ref={modelMenuRef}
                className={`composer-field composer-model-field ${isModelMenuOpen ? 'is-open' : ''}`}
              >
                <span className="composer-field-label">{'\u6a21\u578b'}</span>
                <button
                  type="button"
                  id="model-select"
                  className="composer-model-trigger"
                  onClick={() => setIsModelMenuOpen((open) => !open)}
                  disabled={disabled || modelOptions.length === 0}
                  aria-haspopup="listbox"
                  aria-expanded={isModelMenuOpen}
                  aria-label={'\u6a21\u578b'}
                >
                  <span className="composer-model-value">
                    {selectedOption
                      ? `${selectedOption.label} \u00b7 ${getLatencyLabel(selectedOption.latency_hint)}`
                      : '\u52a0\u8f7d\u4e2d...'}
                  </span>
                  <span className="composer-select-caret" aria-hidden="true">
                    {'\u2304'}
                  </span>
                </button>

                {isModelMenuOpen && (
                  <div className="composer-model-menu" role="listbox" aria-label={'\u6a21\u578b'}>
                    {modelOptions.map((option) => {
                      const isActive = option.id === selectedModel;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={`composer-model-option ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            onModelChange(option.id);
                            setIsModelMenuOpen(false);
                          }}
                        >
                          <span className="composer-model-option-name">{option.label}</span>
                          <span className="composer-model-option-meta">
                            {getLatencyLabel(option.latency_hint)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {reasoningOptions.length > 0 ? (
                <div
                  className="composer-field composer-mode"
                  role="tablist"
                  aria-label={'\u539f\u751f\u601d\u8003'}
                >
                  {reasoningOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`mode-chip ${reasoningLevel === option.value ? 'active' : ''}`}
                      onClick={() => onReasoningLevelChange(option.value)}
                      disabled={disabled}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="composer-status composer-status-muted">
                  {'\u65e0\u539f\u751f\u601d\u8003'}
                </div>
              )}
            </div>

            <button
              type="button"
              className="send-btn"
              onClick={handleSend}
              disabled={disabled || !text.trim()}
              id="send-btn"
              title={'\u53d1\u9001'}
            >
              {'\u2191'}
            </button>
          </div>

          <div
            className={`composer-note ${selectedOption?.experimental_reasoning ? 'experimental' : ''}`}
          >
            {reasoningNote}
          </div>
        </div>

        <div className="input-hint">
          {'Enter \u53d1\u9001\uff0cShift+Enter \u6362\u884c'}
        </div>
      </div>
    </div>
  );
}
