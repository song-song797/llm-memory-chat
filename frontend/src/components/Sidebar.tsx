import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, Project, User } from '../types';
import Icon from './Icons';
import ProjectFormDialog from './ProjectFormDialog';
import ProjectGroup, { ConversationList } from './ProjectGroup';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, currentTitle: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  currentUser: User;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  isClearingAll: boolean;
  projects: Project[];
  activeProjectId: string | null;
  onNewProject: (name: string) => void;
  onNewProjectChat: (projectId: string) => void;
  onRenameProject: (projectId: string, name: string) => void;
  onArchiveProject: (projectId: string) => void;
}

function getUserLabel(email: string): string {
  const localPart = email.split('@')[0]?.trim();
  if (!localPart) {
    return 'My Account';
  }

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ');
}

function getUserInitials(email: string): string {
  const localPart = email.split('@')[0]?.trim();
  if (!localPart) {
    return 'ME';
  }

  const segments = localPart.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[0][0]}${segments[1][0]}`.toUpperCase();
  }

  return localPart.slice(0, 2).toUpperCase();
}

function ConversationMenu({
  conversationId,
  title,
  pinned,
  isOpen,
  onToggle,
  onRename,
  onTogglePin,
  onDelete,
}: {
  conversationId: string;
  title: string;
  pinned: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onRename: (id: string, currentTitle: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <Icon name="more-1" />
      </button>
      {pinned ? (
        <span className="shell-conversation-pin" aria-label="Pinned conversation">
          <Icon name="pin" />
        </span>
      ) : null}
      {isOpen && menuPosition && isMounted
        ? createPortal(
            <div
              className="shell-conversation-menu"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              }}
            >
              <button
                type="button"
                className="shell-conversation-menu-item"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDeleteDialogOpen(false);
                  onTogglePin(conversationId, pinned);
                }}
              >
                <Icon name="pin" />
                <span>{pinned ? '取消置顶' : '置顶'}</span>
              </button>
              <button
                type="button"
                className="shell-conversation-menu-item"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDeleteDialogOpen(false);
                  onRename(conversationId, title);
                }}
              >
                <Icon name="pen" />
                <span>重命名</span>
              </button>
              <button
                type="button"
                className="shell-conversation-menu-item is-danger"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDeleteDialogOpen(true);
                  onToggle();
                }}
              >
                <Icon name="delete" />
                <span>删除</span>
              </button>
            </div>,
            document.body
          )
        : null}
      {isDeleteDialogOpen && isMounted
        ? createPortal(
            <div className="shell-confirm-layer" role="presentation">
              <button
                type="button"
                className="shell-confirm-backdrop"
                aria-label="Close delete confirmation"
                onClick={() => setIsDeleteDialogOpen(false)}
              />
              <div
                className="shell-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`delete-conversation-title-${conversationId}`}
              >
                <h3
                  id={`delete-conversation-title-${conversationId}`}
                  className="shell-confirm-title"
                >
                  确认删除会话？
                </h3>
                <p className="shell-confirm-text">
                  删除后将无法恢复，确认删除“{title}”吗？
                </p>
                <div className="shell-confirm-actions">
                  <button
                    type="button"
                    className="shell-confirm-button"
                    onClick={() => setIsDeleteDialogOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="shell-confirm-button is-danger"
                    onClick={() => {
                      setIsDeleteDialogOpen(false);
                      onDelete(conversationId);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
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
  onRename,
  onTogglePin,
  onClearAll,
  onOpenSettings,
  onLogout,
  currentUser,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapsed,
  isClearingAll,
  projects,
  activeProjectId,
  onNewProject,
  onNewProjectChat,
  onRenameProject,
  onArchiveProject,
}: SidebarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSearchOpen]);

  useEffect(() => {
    if (conversations.length > 0) {
      return;
    }

    setIsClearConfirming(false);
  }, [conversations.length]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredConversations = useMemo(() => {
    if (!normalizedQuery) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(normalizedQuery)
    );
  }, [conversations, normalizedQuery]);

  const ordinaryConversations = useMemo(
    () => filteredConversations.filter((conversation) => !conversation.project_id),
    [filteredConversations]
  );
  const conversationsByProject = useMemo(() => {
    const groups = new Map<string, Conversation[]>();
    for (const project of projects) {
      groups.set(project.id, []);
    }
    for (const conversation of filteredConversations) {
      if (!conversation.project_id) {
        continue;
      }
      groups.get(conversation.project_id)?.push(conversation);
    }
    return groups;
  }, [filteredConversations, projects]);
  const visibleProjects = useMemo(() => {
    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) => (conversationsByProject.get(project.id)?.length ?? 0) > 0);
  }, [conversationsByProject, normalizedQuery, projects]);
  const compactConversationId =
    activeId ?? filteredConversations[0]?.id ?? conversations[0]?.id ?? null;
  const hasConversations = conversations.length > 0;
  const hasSearchQuery = normalizedQuery.length > 0;
  const showSearchResults = isSearchOpen && hasSearchQuery;
  const showOrdinaryGroup = !showSearchResults || ordinaryConversations.length > 0;
  const searchResultCount = filteredConversations.length;
  const currentUserLabel = getUserLabel(currentUser.email);
  const currentUserInitials = getUserInitials(currentUser.email);

  const handleConversationDelete = (id: string) => {
    setOpenConversationMenuId(null);
    onDelete(id);
  };

  const handleConversationRename = (id: string, currentTitle: string) => {
    setOpenConversationMenuId(null);
    setEditingConversationId(id);
    setEditingTitle(currentTitle);
  };

  const handleConversationPinToggle = (id: string, pinned: boolean) => {
    setOpenConversationMenuId(null);
    onTogglePin(id, pinned);
  };

  const handleRenameSubmit = () => {
    if (!editingConversationId) {
      return;
    }

    const targetConversation = conversations.find(
      (conversation) => conversation.id === editingConversationId
    );
    const nextTitle = editingTitle.trim();

    setEditingConversationId(null);

    if (!targetConversation || !nextTitle || nextTitle === targetConversation.title) {
      setEditingTitle('');
      return;
    }

    setEditingTitle('');
    onRename(editingConversationId, nextTitle);
  };

  const handleRenameCancel = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const handleToggleSearch = () => {
    if (isCollapsed) {
      onToggleCollapsed();
      setIsSearchOpen(true);
      return;
    }

    setIsSearchOpen((current) => {
      const next = !current;
      if (!next) {
        setSearchQuery('');
      }
      return next;
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearchQuery('');
      setIsSearchOpen(false);
    }
  };

  const handleClearAll = () => {
    if (isClearingAll) {
      return;
    }

    if (!isClearConfirming) {
      setIsClearConfirming(true);
      return;
    }

    onClearAll();
  };

  const renderConversationActions = (conversation: Conversation) => (
    <ConversationMenu
      conversationId={conversation.id}
      title={conversation.title}
      pinned={conversation.pinned}
      isOpen={openConversationMenuId === conversation.id}
      onToggle={() =>
        setOpenConversationMenuId((prev) => (prev === conversation.id ? null : conversation.id))
      }
      onRename={handleConversationRename}
      onTogglePin={handleConversationPinToggle}
      onDelete={handleConversationDelete}
    />
  );

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

            <div className={`shell-create-row ${isSearchOpen ? 'is-search-open' : ''}`}>
              <button className="shell-new-chat" type="button" onClick={onNew}>
                <span className="shell-new-chat-plus">+</span>
                <span>New chat</span>
              </button>
              <button
                className={`shell-search-button ${isSearchOpen ? 'is-active' : ''}`}
                type="button"
                aria-label={isSearchOpen ? 'Close search' : 'Search conversations'}
                data-tooltip={isSearchOpen ? 'Close search' : 'Search conversations'}
                onClick={handleToggleSearch}
              >
                <Icon name={isSearchOpen ? 'close' : 'search'} />
              </button>
            </div>

            <div className={`shell-search-panel ${isSearchOpen ? 'is-open' : ''}`}>
              <div className="shell-search-input-wrap">
                <span className="shell-search-input-icon">
                  <Icon name="search" />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  placeholder="Search conversations..."
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="shell-search-clear"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                  >
                    <Icon name="close" />
                  </button>
                ) : null}
              </div>
              <div className="shell-search-meta">
                <span>
                  {hasSearchQuery
                    ? `${searchResultCount} result${searchResultCount === 1 ? '' : 's'}`
                    : 'Type to filter your conversations in real time'}
                </span>
              </div>
            </div>

            <div className="shell-section-head">
              <span>{showSearchResults ? 'Search results' : 'Your conversations'}</span>
              {isClearConfirming ? (
                <div className="shell-clear-confirm">
                  <button
                    type="button"
                    className="shell-clear-cancel"
                    onClick={() => setIsClearConfirming(false)}
                    disabled={isClearingAll}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="shell-clear-confirm-button"
                    onClick={handleClearAll}
                    disabled={!hasConversations || isClearingAll}
                  >
                    {isClearingAll ? 'Clearing...' : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="shell-clear-button"
                  onClick={handleClearAll}
                  disabled={!hasConversations || isClearingAll}
                >
                  {isClearingAll ? 'Clearing...' : 'Clear All'}
                </button>
              )}
            </div>

            {showOrdinaryGroup ? (
              <>
                <div className="shell-section-label">普通聊天</div>
                <ConversationList
                  conversations={ordinaryConversations}
                  activeId={activeId}
                  editingConversationId={editingConversationId}
                  editingTitle={editingTitle}
                  onSelect={onSelect}
                  onEditingTitleChange={setEditingTitle}
                  onEditingSubmit={handleRenameSubmit}
                  onEditingCancel={handleRenameCancel}
                  renderActions={renderConversationActions}
                />

                {ordinaryConversations.length === 0 ? (
                  <div className="shell-empty-history">Your ordinary chats will appear here.</div>
                ) : null}

                <div className="shell-divider" />
              </>
            ) : null}

            <div className="shell-section-head shell-section-head--projects">
              <span>Projects</span>
              <button
                type="button"
                className="shell-project-add"
                aria-label="Create project"
                onClick={() => setIsProjectDialogOpen(true)}
              >
                +
              </button>
            </div>

            <div className="shell-project-list">
              {visibleProjects.map((project) => (
                <ProjectGroup
                  key={project.id}
                  project={project}
                  conversations={conversationsByProject.get(project.id) ?? []}
                  activeId={activeId}
                  activeProjectId={activeProjectId}
                  onNewChat={() => onNewProjectChat(project.id)}
                  onRenameProject={onRenameProject}
                  onArchiveProject={onArchiveProject}
                  editingConversationId={editingConversationId}
                  editingTitle={editingTitle}
                  onSelect={onSelect}
                  onEditingTitleChange={setEditingTitle}
                  onEditingSubmit={handleRenameSubmit}
                  onEditingCancel={handleRenameCancel}
                  renderActions={renderConversationActions}
                />
              ))}
            </div>

            {showSearchResults && filteredConversations.length === 0 ? (
              <div className="shell-search-empty">
                <strong>No conversations found</strong>
                <span>Try a different keyword or clear the search.</span>
              </div>
            ) : null}

            {!showSearchResults && visibleProjects.length === 0 ? (
              <div className="shell-muted-item">
                <span>No projects yet.</span>
              </div>
            ) : null}

            {isProjectDialogOpen ? (
              <ProjectFormDialog
                title="Create project"
                onSubmit={(name) => {
                  setIsProjectDialogOpen(false);
                  onNewProject(name);
                }}
                onClose={() => setIsProjectDialogOpen(false)}
              />
            ) : null}

            <div className="shell-sidebar-spacer" />

            <div className="shell-profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className={`shell-footer-pill ${isProfileMenuOpen ? 'is-open' : ''}`}
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                aria-expanded={isProfileMenuOpen}
                aria-label="Open profile menu"
              >
                <span className="shell-avatar-chip shell-avatar-initials" aria-hidden="true">
                  {currentUserInitials}
                </span>
                <span>{currentUserLabel}</span>
              </button>

              {isProfileMenuOpen && (
                <div className="shell-profile-menu">
                  <button type="button" className="shell-profile-card">
                    <span
                      className="shell-profile-card-avatar shell-avatar-initials"
                      aria-hidden="true"
                    >
                      {currentUserInitials}
                    </span>
                    <span className="shell-profile-card-copy">
                      <strong>{currentUserLabel}</strong>
                      <span>{currentUser.email}</span>
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
                    <button
                      type="button"
                      className="shell-profile-menu-item"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                    >
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
            className={`shell-compact-icon ${isSearchOpen ? 'is-active' : ''}`}
            aria-label="Search conversations"
            onClick={handleToggleSearch}
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
            <span className="shell-compact-avatar-dot shell-avatar-initials" aria-hidden="true">
              {currentUserInitials}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
