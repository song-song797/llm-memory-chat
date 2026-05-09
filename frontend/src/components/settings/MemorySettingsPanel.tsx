import MemoryDocumentSection from './MemoryDocumentSection';
import type { Memory, MemoryCandidate, MemoryDocument, MemoryScope } from '../../types';

interface MemorySettingsPanelProps {
  activeProjectName: string | null;
  activeConversationId: string | null;
  globalMemories: Memory[];
  projectMemories: Memory[];
  conversationMemories: Memory[];
  globalMemoryDocument: MemoryDocument | null;
  projectMemoryDocument: MemoryDocument | null;
  conversationMemoryDocument: MemoryDocument | null;
  globalMemoryDraft: string;
  projectMemoryDraft: string;
  conversationMemoryDraft: string;
  memoryCandidates: MemoryCandidate[];
  isMemoriesLoading: boolean;
  isMemoryMutating: boolean;
  onGlobalMemoryDraftChange: (value: string) => void;
  onProjectMemoryDraftChange: (value: string) => void;
  onConversationMemoryDraftChange: (value: string) => void;
  onCreateGlobalMemory: () => void;
  onCreateProjectMemory: () => void;
  onCreateConversationMemory: () => void;
  onToggleMemory: (memory: Memory) => void;
  onDeleteMemory: (memory: Memory) => void;
  onAcceptMemoryCandidate: (candidate: MemoryCandidate) => void;
  onDismissMemoryCandidate: (candidate: MemoryCandidate) => void;
}

function getScopeLabel(scope: MemoryScope): string {
  switch (scope) {
    case 'project':
      return '项目建议';
    case 'conversation':
      return '会话建议';
    default:
      return '全局建议';
  }
}

function getActionLabel(action?: string | null): string {
  switch (action) {
    case 'update':
      return '更新';
    case 'archive':
      return '归档';
    default:
      return '新增';
  }
}

export default function MemorySettingsPanel({
  activeProjectName,
  activeConversationId,
  globalMemories,
  projectMemories,
  conversationMemories,
  globalMemoryDocument,
  projectMemoryDocument,
  conversationMemoryDocument,
  globalMemoryDraft,
  projectMemoryDraft,
  conversationMemoryDraft,
  memoryCandidates,
  isMemoriesLoading,
  isMemoryMutating,
  onGlobalMemoryDraftChange,
  onProjectMemoryDraftChange,
  onConversationMemoryDraftChange,
  onCreateGlobalMemory,
  onCreateProjectMemory,
  onCreateConversationMemory,
  onToggleMemory,
  onDeleteMemory,
  onAcceptMemoryCandidate,
  onDismissMemoryCandidate,
}: MemorySettingsPanelProps) {
  const candidateGroups = (['global', 'project', 'conversation'] as MemoryScope[]).map((scope) => ({
    scope,
    items: memoryCandidates.filter((candidate) => candidate.scope === scope),
  }));

  return (
    <>
      {activeProjectName ? (
        <MemoryDocumentSection
          title={`${activeProjectName} 记忆`}
          scope="project"
          document={projectMemoryDocument}
          memories={projectMemories}
          draft={projectMemoryDraft}
          placeholder="添加项目记忆"
          addLabel="添加"
          emptyLabel="这个项目还没有记忆。"
          isLoading={isMemoriesLoading}
          isMutating={isMemoryMutating}
          onDraftChange={onProjectMemoryDraftChange}
          onCreate={onCreateProjectMemory}
          onToggle={onToggleMemory}
          onDelete={onDeleteMemory}
        />
      ) : null}

      {activeConversationId ? (
        <MemoryDocumentSection
          title="当前会话记忆"
          scope="conversation"
          document={conversationMemoryDocument}
          memories={conversationMemories}
          draft={conversationMemoryDraft}
          placeholder="添加会话记忆"
          addLabel="添加"
          emptyLabel="这个会话还没有记忆。"
          isLoading={isMemoriesLoading}
          isMutating={isMemoryMutating}
          onDraftChange={onConversationMemoryDraftChange}
          onCreate={onCreateConversationMemory}
          onToggle={onToggleMemory}
          onDelete={onDeleteMemory}
        />
      ) : null}

      <MemoryDocumentSection
        title="全局记忆"
        scope="global"
        document={globalMemoryDocument}
        memories={globalMemories}
        draft={globalMemoryDraft}
        placeholder="添加全局偏好"
        addLabel="添加"
        emptyLabel="还没有全局记忆。"
        isLoading={isMemoriesLoading}
        isMutating={isMemoryMutating}
        onDraftChange={onGlobalMemoryDraftChange}
        onCreate={onCreateGlobalMemory}
        onToggle={onToggleMemory}
        onDelete={onDeleteMemory}
      />

      <section className="settings-section">
        <div className="settings-section-head">
          <h3>建议记忆</h3>
          <span>{isMemoriesLoading ? '加载中' : `待处理 ${memoryCandidates.length} 条`}</span>
        </div>
        {memoryCandidates.length === 0 ? (
          <div className="settings-empty">暂无建议记忆。</div>
        ) : (
          <div className="memory-candidate-groups">
            {candidateGroups.map(({ scope, items }) =>
              items.length > 0 ? (
                <div key={scope} className="memory-candidate-group">
                  <h4>{getScopeLabel(scope)}</h4>
                  <div className="memory-candidate-list">
                    {items.map((candidate) => (
                      <div key={candidate.id} className="memory-candidate-item">
                        <div className="memory-candidate-meta">
                          <span>{getActionLabel(candidate.action)}</span>
                        </div>
                        <p className="memory-candidate-content">{candidate.content}</p>
                        {candidate.reason ? (
                          <p className="memory-candidate-reason">{candidate.reason}</p>
                        ) : null}
                        <div className="memory-candidate-actions">
                          <button
                            type="button"
                            onClick={() => onAcceptMemoryCandidate(candidate)}
                            disabled={isMemoryMutating}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => onDismissMemoryCandidate(candidate)}
                            disabled={isMemoryMutating}
                          >
                            忽略
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </section>
    </>
  );
}
