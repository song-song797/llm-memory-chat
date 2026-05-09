interface GeneralSettingsPanelProps {
  selectedTheme: SettingsTheme;
  onThemeChange: (theme: SettingsTheme) => void;
}

const THEME_OPTIONS = [
  {
    value: 'neutral',
    label: 'Neutral',
    description: 'System-like white',
    swatchClassName: 'settings-theme-swatch-neutral',
  },
  {
    value: 'rose',
    label: 'Rose',
    description: 'Soft pink',
    swatchClassName: 'settings-theme-swatch-rose',
  },
  {
    value: 'butter',
    label: 'Butter',
    description: 'Warm yellow',
    swatchClassName: 'settings-theme-swatch-butter',
  },
  {
    value: 'mist',
    label: 'Mist',
    description: 'Quiet blue',
    swatchClassName: 'settings-theme-swatch-mist',
  },
  {
    value: 'mint',
    label: 'Mint',
    description: 'Fresh green',
    swatchClassName: 'settings-theme-swatch-mint',
  },
] as const;

export type SettingsTheme = (typeof THEME_OPTIONS)[number]['value'];

export default function GeneralSettingsPanel({
  selectedTheme,
  onThemeChange,
}: GeneralSettingsPanelProps) {
  return (
    <div className="settings-panel-stack">
      <section className="settings-panel-section" aria-labelledby="appearance-settings-title">
        <div className="settings-panel-section-head">
          <h3 id="appearance-settings-title">外观</h3>
          <p>选择整个应用的主题背景。</p>
        </div>

        <div className="settings-theme-options" role="group" aria-label="主题选择">
          {THEME_OPTIONS.map((option) => {
            const isSelected = selectedTheme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={`settings-theme-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onThemeChange(option.value)}
                aria-pressed={isSelected}
              >
                <span
                  className={`settings-theme-swatch ${option.swatchClassName}`}
                  aria-hidden="true"
                />
                <span className="settings-theme-option-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
