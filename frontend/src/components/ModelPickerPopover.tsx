import type { ModelOption, ReasoningLevel } from '../types';

interface ModelPickerPopoverProps {
  isOpen: boolean;
  modelOptions: ModelOption[];
  selectedModel: string;
  selectedOption: ModelOption | null;
  reasoningLevel: ReasoningLevel;
  onModelChange(value: string): void;
  onReasoningLevelChange(level: ReasoningLevel): void;
  onClose(): void;
}

function getLatencyLabel(latencyHint?: string | null): string {
  switch (latencyHint) {
    case 'fast':
      return 'Fast';
    case 'balanced':
      return 'Balanced';
    case 'slower':
      return 'Deep';
    default:
      return 'Ready';
  }
}

function getReasoningOptions(option?: ModelOption | null): Array<{
  value: ReasoningLevel;
  label: string;
}> {
  switch (option?.reasoning_mode) {
    case 'toggle':
      return [
        { value: 'off', label: 'Direct' },
        { value: 'standard', label: 'Think' },
      ];
    case 'budget':
      return [
        { value: 'off', label: 'Direct' },
        { value: 'standard', label: 'Standard' },
        { value: 'deep', label: 'Deep' },
      ];
    case 'always_budget':
      return [
        { value: 'standard', label: 'Standard' },
        { value: 'deep', label: 'Deep' },
      ];
    default:
      return [];
  }
}

function getReasoningHint(option?: ModelOption | null): string {
  switch (option?.reasoning_mode) {
    case 'toggle':
      return 'This model supports a lightweight native thinking toggle.';
    case 'budget':
      return 'This model lets you balance speed and depth before each answer.';
    case 'always_budget':
      return 'This model always thinks first, but you can still choose the depth.';
    default:
      return 'This model does not expose reasoning controls right now.';
  }
}

export default function ModelPickerPopover({
  isOpen,
  modelOptions,
  selectedModel,
  selectedOption,
  reasoningLevel,
  onModelChange,
  onReasoningLevelChange,
  onClose,
}: ModelPickerPopoverProps) {
  if (!isOpen) {
    return null;
  }

  const reasoningOptions = getReasoningOptions(selectedOption);

  const handleModelChange = (value: string) => {
    onModelChange(value);
    onClose();
  };

  return (
    <div className="model-picker-layer">
      <button
        type="button"
        className="model-picker-backdrop"
        aria-label="Close model picker"
        onClick={onClose}
      />
      <aside className="model-picker-popover" aria-label="Model picker">
        <section className="model-picker-section">
          <div className="model-picker-head">
            <h3>Model</h3>
            <span>{selectedOption ? getLatencyLabel(selectedOption.latency_hint) : 'Loading'}</span>
          </div>
          {modelOptions.length > 0 ? (
            <div className="model-picker-grid">
              {modelOptions.map((option) => {
                const isActive = option.id === selectedModel;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`model-picker-option ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleModelChange(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{getLatencyLabel(option.latency_hint)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="model-picker-empty">No models are available right now.</div>
          )}
        </section>

        <section className="model-picker-section">
          <div className="model-picker-head">
            <h3>Reasoning</h3>
            <span>{selectedOption?.experimental_reasoning ? 'Experimental' : 'Stable'}</span>
          </div>
          {reasoningOptions.length > 0 ? (
            <div className="model-picker-chip-row">
              {reasoningOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`model-picker-chip ${
                    reasoningLevel === option.value ? 'is-active' : ''
                  }`}
                  onClick={() => onReasoningLevelChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="model-picker-empty">No reasoning modes are available for this model.</div>
          )}
          <p className="model-picker-hint">{getReasoningHint(selectedOption)}</p>
        </section>
      </aside>
    </div>
  );
}
