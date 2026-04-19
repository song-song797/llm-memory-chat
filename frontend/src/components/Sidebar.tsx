import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation } from '../types';
import Icon from './Icons';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

function formatConversationTitle(title: string): string {
  return title.length > 28 ? `${title.slice(0, 28)}...` : title;
}

function ConversationMenu({
  conversationId,
  isOpen,
  onToggle,
  onDelete,
}: {
  conversationId: string;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateMenuPosition = () => {
      if (!buttonRef.current) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top,
        left: rect.left,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  return (
    <span className="shell-conversation-menu-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="shell-more-button"
        aria-label="More actions"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <Icon name="more-1" />
      </button>
      {isOpen && menuPosition && isMounted
        ? createPortal(
            <div
              className="shell-conversation-menu"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              }}
            >
              <button type="button" className="shell-conversation-menu-item">
                <Icon name="pin" />
                <span>置顶</span>
              </button>
              <button type="button" className="shell-conversation-menu-item">
                <Icon name="pen" />
                <span>重命名</span>
              </button>
              <button
                type="button"
                className="shell-conversation-menu-item is-danger"
                onClick={() => onDelete(conversationId)}
              >
                <Icon name="delete" />
                <span>删除</span>
              </button>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const primaryConversations = conversations.slice(0, 6);
  const recentConversations = conversations.slice(6, 9);
  const compactConversationId =
    activeId ?? primaryConversations[0]?.id ?? recentConversations[0]?.id ?? null;
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (!profileMenuRef.current?.contains(target)) {
        setIsProfileMenuOpen(false);
      }

      if (
        !target.closest('.shell-conversation-menu-wrap') &&
        !target.closest('.shell-conversation-menu')
      ) {
        setOpenConversationMenuId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleConversationDelete = (id: string) => {
    setOpenConversationMenuId(null);
    onDelete(id);
  };

  return (
    <aside
      className={`shell-sidebar ${isMobileOpen ? 'is-mobile-open' : ''} ${
        isCollapsed ? 'is-collapsed' : ''
      }`}
    >
      <div className="shell-sidebar-inner">
        <div className="shell-sidebar-panel shell-sidebar-panel--expanded">
          <div className="shell-sidebar-scroll">
            <div className="shell-brand-row">
              <div className="shell-brand">CHAT A.I+</div>
              <div className="shell-brand-actions">
                <button
                  type="button"
                  className="shell-sidebar-collapse"
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={onToggleCollapsed}
                >
                  <Icon name="left-side" />
                </button>
                <button
                  type="button"
                  className="shell-sidebar-close"
                  aria-label="Close conversations"
                  onClick={onCloseMobile}
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <div className="shell-create-row">
              <button className="shell-new-chat" type="button" onClick={onNew}>
                <span className="shell-new-chat-plus">+</span>
                <span>New chat</span>
              </button>
              <button
                className="shell-search-button"
                type="button"
                aria-label="Search conversations"
              >
                <Icon name="search" />
              </button>
            </div>

            <div className="shell-section-head">
              <span>Your conversations</span>
              <button type="button" className="shell-clear-button">
                Clear All
              </button>
            </div>

            <div className="shell-conversation-list">
              {primaryConversations.map((conversation) => {
                const isActive = conversation.id === activeId;

                return (
                  <div
                    key={conversation.id}
                    className={`shell-conversation-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => onSelect(conversation.id)}
                  >
                    <button
                      type="button"
                      className="shell-conversation-select"
                      onClick={() => onSelect(conversation.id)}
                    >
                      <span className="shell-conversation-title">
                        {formatConversationTitle(conversation.title)}
                      </span>
                    </button>

                    <span className="shell-conversation-actions">
                      <ConversationMenu
                        conversationId={conversation.id}
                        isOpen={openConversationMenuId === conversation.id}
                        onToggle={() =>
                          setOpenConversationMenuId((prev) =>
                            prev === conversation.id ? null : conversation.id
                          )
                        }
                        onDelete={handleConversationDelete}
                      />
                    </span>
                  </div>
                );
              })}

              {primaryConversations.length === 0 && (
                <div className="shell-empty-history">Your recent chats will appear here.</div>
              )}
            </div>

            <div className="shell-divider" />

            <div className="shell-section-label">Last 7 Days</div>
            <div className="shell-conversation-list shell-conversation-list--recent">
              {recentConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="shell-conversation-item"
                  onClick={() => onSelect(conversation.id)}
                >
                  <button
                    type="button"
                    className="shell-conversation-select"
                    onClick={() => onSelect(conversation.id)}
                  >
                    <span className="shell-conversation-title">
                      {formatConversationTitle(conversation.title)}
                    </span>
                  </button>
                  <span className="shell-conversation-actions">
                    <ConversationMenu
                      conversationId={conversation.id}
                      isOpen={openConversationMenuId === conversation.id}
                      onToggle={() =>
                        setOpenConversationMenuId((prev) =>
                          prev === conversation.id ? null : conversation.id
                        )
                      }
                      onDelete={handleConversationDelete}
                    />
                  </span>
                </div>
              ))}

              {recentConversations.length === 0 && (
                <div className="shell-muted-item">
                  <span>Min States For Binary DFA</span>
                </div>
              )}
            </div>

            <div className="shell-sidebar-spacer" />

            <div className="shell-profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className={`shell-footer-pill ${isProfileMenuOpen ? 'is-open' : ''}`}
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                aria-expanded={isProfileMenuOpen}
                aria-label="Open profile menu"
              >
                <img
                  className="shell-avatar-chip"
                  src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
                  alt="Andrew Neilson"
                />
                <span>Andrew Neilson</span>
              </button>

              {isProfileMenuOpen && (
                <div className="shell-profile-menu">
                  <button type="button" className="shell-profile-card">
                    <img
                      className="shell-profile-card-avatar"
                      src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
                      alt="Andrew Neilson"
                    />
                    <span className="shell-profile-card-copy">
                      <strong>Andrew Neilson</strong>
                      <span>Plus</span>
                    </span>
                    <span className="shell-profile-card-arrow">
                      <Icon name="arrow-right" />
                    </span>
                  </button>

                  <div className="shell-profile-menu-section">
                    <button type="button" className="shell-profile-menu-item">
                      <Icon name="sparkles" />
                      <span className="shell-profile-menu-label">Upgrade plan</span>
                    </button>
                    <button type="button" className="shell-profile-menu-item">
                      <Icon name="personalization" />
                      <span className="shell-profile-menu-label">Personalization</span>
                    </button>
                    <button type="button" className="shell-profile-menu-item">
                      <Icon name="profile" />
                      <span className="shell-profile-menu-label">Profile</span>
                    </button>
                    <button
                      type="button"
                      className="shell-profile-menu-item"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenSettings();
                      }}
                    >
                      <Icon name="settings" />
                      <span className="shell-profile-menu-label">Settings</span>
                    </button>
                  </div>

                  <div className="shell-profile-menu-section shell-profile-menu-section--secondary">
                    <button type="button" className="shell-profile-menu-item">
                      <Icon name="help" />
                      <span className="shell-profile-menu-label">Help</span>
                    </button>
                    <button type="button" className="shell-profile-menu-item">
                      <Icon name="logout" />
                      <span className="shell-profile-menu-label">Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shell-sidebar-panel shell-sidebar-panel--compact">
          <button
            type="button"
            className="shell-compact-icon shell-compact-toggle"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapsed}
          >
            <Icon name="left-side" />
          </button>

          <button
            type="button"
            className="shell-compact-icon"
            aria-label="New chat"
            onClick={onNew}
          >
            <Icon name="edit" />
          </button>

          <button
            type="button"
            className="shell-compact-icon"
            aria-label="Search conversations"
          >
            <Icon name="search" />
          </button>

          <button
            type="button"
            className={`shell-compact-icon ${compactConversationId ? 'is-active' : ''}`}
            aria-label="Open conversation"
            onClick={() => {
              if (compactConversationId) {
                onSelect(compactConversationId);
                return;
              }

              onNew();
            }}
          >
            <Icon name="chat" />
          </button>

          <div className="shell-compact-spacer" />

          <button
            type="button"
            className="shell-compact-avatar"
            aria-label="Open settings"
            onClick={onOpenSettings}
          >
            <img
              className="shell-compact-avatar-dot"
              src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
              alt="Andrew Neilson"
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
