import { useState } from 'react';

interface DataSettingsPanelProps {
  hasConversations: boolean;
  isClearingAll: boolean;
  onClearAllConversations: () => void;
}

export default function DataSettingsPanel({
  hasConversations,
  isClearingAll,
  onClearAllConversations,
}: DataSettingsPanelProps) {
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const canClear = hasConversations && !isClearingAll;
  const isConfirmingEnabledClear = canClear && isConfirmingClearAll;

  const handleClearClick = () => {
    if (!canClear) {
      return;
    }

    if (!isConfirmingEnabledClear) {
      setIsConfirmingClearAll(true);
      return;
    }

    onClearAllConversations();
    setIsConfirmingClearAll(false);
  };

  return (
    <div className="settings-panel-stack">
      <section className="settings-panel-section" aria-labelledby="data-management-title">
        <div className="settings-panel-section-head">
          <h3 id="data-management-title">数据管理</h3>
          <p>管理保存在当前账户下的会话数据。</p>
        </div>

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>清空所有会话</strong>
            <span>
              {hasConversations
                ? '删除侧边栏中的全部聊天记录。'
                : '当前没有可清空的会话。'}
            </span>
            {isConfirmingEnabledClear ? (
              <span className="settings-row-warning">再次点击确认清空。</span>
            ) : null}
          </div>
          <button
            type="button"
            className={`settings-danger-button ${isConfirmingEnabledClear ? 'is-confirming' : ''}`}
            onClick={handleClearClick}
            disabled={!canClear}
          >
            {isClearingAll ? '清空中...' : isConfirmingEnabledClear ? '确认清空' : '清空会话'}
          </button>
        </div>
      </section>
    </div>
  );
}
