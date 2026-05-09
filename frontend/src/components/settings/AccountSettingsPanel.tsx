import type { User } from '../../types';

interface AccountSettingsPanelProps {
  currentUser: User;
  onLogout: () => void;
}

export default function AccountSettingsPanel({
  currentUser,
  onLogout,
}: AccountSettingsPanelProps) {
  return (
    <div className="settings-panel-stack">
      <section className="settings-panel-section" aria-labelledby="account-settings-title">
        <div className="settings-panel-section-head">
          <h3 id="account-settings-title">账户</h3>
          <p>查看当前登录状态。</p>
        </div>

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>{currentUser.email}</strong>
            <span>已登录账户</span>
          </div>
          <button type="button" className="settings-secondary-button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </section>
    </div>
  );
}
