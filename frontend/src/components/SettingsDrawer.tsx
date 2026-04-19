import type { ModelOption, ReasoningLevel } from '../types';

interface SettingsDrawerProps {
  isOpen: boolean;
  modelOptions: ModelOption[];
  selectedModel: string;
  selectedOption: ModelOption | null;
  onModelChange: (value: string) => void;
  reasoningLevel: ReasoningLevel;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
  onClose: () => void;
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

export default function SettingsDrawer({
  isOpen,
  modelOptions,
  selectedModel,
  selectedOption,
  onModelChange,
  reasoningLevel,
  onReasoningLevelChange,
  onClose,
}: SettingsDrawerProps) {
  const reasoningOptions = getReasoningOptions(selectedOption);

  return (
    <div className={`settings-layer ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
      <button className="settings-backdrop" type="button" onClick={onClose} />
      <aside className="settings-drawer">
        <div className="settings-header">
          <div>
            <p className="settings-kicker">Current setup</p>
            <h2>Chat settings</h2>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
            <span />
            <span />
          </button>
        </div>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Model</h3>
            <span>{selectedOption ? getLatencyLabel(selectedOption.latency_hint) : 'Loading'}</span>
          </div>
          <div className="settings-option-grid">
            {modelOptions.map((option) => {
              const isActive = option.id === selectedModel;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`settings-option-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => onModelChange(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{getLatencyLabel(option.latency_hint)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Reasoning</h3>
            <span>{selectedOption?.experimental_reasoning ? 'Experimental' : 'Stable'}</span>
          </div>
          {reasoningOptions.length > 0 ? (
            <div className="settings-chip-row">
              {reasoningOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-chip ${reasoningLevel === option.value ? 'is-active' : ''}`}
                  onClick={() => onReasoningLevelChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="settings-empty">No reasoning modes are available for this model.</div>
          )}
          <p className="settings-hint">{getReasoningHint(selectedOption)}</p>
        </section>
      </aside>
    </div>
  );
}
