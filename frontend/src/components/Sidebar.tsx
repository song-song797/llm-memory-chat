import type { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>
          <span className="logo-icon">AI</span>
          Memory Chat
        </h1>
        <button className="new-chat-btn" onClick={onNew} id="new-chat-btn">
          <span>+</span> {'\u65b0\u5bf9\u8bdd'}
        </button>
      </div>

      <div className="conversation-list" id="conversation-list">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${conv.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <span className="conv-title">{conv.title}</span>
            <button
              className="conv-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              title={'\u5220\u9664\u5bf9\u8bdd'}
            >
              x
            </button>
          </div>
        ))}

        {conversations.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            {'\u6682\u65e0\u5bf9\u8bdd\u8bb0\u5f55'}
          </div>
        )}
      </div>

      <div className="sidebar-footer">{'LLM + \u6c38\u4e45\u8bb0\u5fc6 \u00b7 Demo v0.1'}</div>
    </aside>
  );
}
