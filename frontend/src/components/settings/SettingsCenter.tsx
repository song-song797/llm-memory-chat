import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import Icon from '../Icons';

export type SettingsSectionId = 'general' | 'memory' | 'data' | 'account';

interface SettingsCenterProps {
  isOpen: boolean;
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  onClose: () => void;
  panels: Record<SettingsSectionId, ReactNode>;
}

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: string;
}> = [
  { id: 'general', label: '常规', icon: 'settings' },
  { id: 'memory', label: '记忆', icon: 'personalization' },
  { id: 'data', label: '数据管理', icon: 'task' },
  { id: 'account', label: '账户', icon: 'profile' },
];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.tabIndex >= 0 && element.getClientRects().length > 0
  );
}

export default function SettingsCenter({
  isOpen,
  activeSection,
  onSectionChange,
  onClose,
  panels,
}: SettingsCenterProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTarget = closeButtonRef.current ?? getFocusableElements(layerRef.current)[0];
    focusTarget?.focus();

    return () => {
      const previousActiveElement = previousActiveElementRef.current;
      previousActiveElementRef.current = null;

      if (previousActiveElement && document.contains(previousActiveElement)) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getFocusableElements(layerRef.current);
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isFocusInside = Boolean(activeElement && layerRef.current?.contains(activeElement));

    if (event.shiftKey && (!isFocusInside || activeElement === firstElement)) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && (!isFocusInside || activeElement === lastElement)) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  if (!isOpen) {
    return null;
  }

  const activeItem =
    SETTINGS_SECTIONS.find((section) => section.id === activeSection) ?? SETTINGS_SECTIONS[0];

  return (
    <div
      ref={layerRef}
      className="settings-center-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onKeyDown={handleKeyDown}
    >
      <div className="settings-center-shell">
        <nav className="settings-center-nav" aria-label="设置分类">
          <button
            ref={closeButtonRef}
            type="button"
            className="settings-center-close"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <Icon name="close" />
          </button>
          <div className="settings-center-menu">
            {SETTINGS_SECTIONS.map((section) => {
              const isActive = section.id === activeSection;

              return (
                <button
                  key={section.id}
                  type="button"
                  className={`settings-center-menu-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSectionChange(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon name={section.icon} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <main className="settings-center-content">
          <div className="settings-center-content-head">
            <h2>{activeItem.label}</h2>
          </div>
          <section className="settings-center-panel">{panels[activeSection]}</section>
        </main>
      </div>
    </div>
  );
}
