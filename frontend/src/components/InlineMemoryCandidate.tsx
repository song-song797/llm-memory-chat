import type { MemoryCandidate, MemoryScope } from '../types';

interface InlineMemoryCandidateProps {
  candidate: MemoryCandidate;
  isMutating: boolean;
  onAccept: (candidate: MemoryCandidate) => void;
  onDefer: (candidate: MemoryCandidate) => void;
  onDismiss: (candidate: MemoryCandidate) => void;
}

function getScopeLabel(scope: MemoryScope): string {
  switch (scope) {
    case 'project':
      return '项目记忆';
    case 'conversation':
      return '会话记忆';
    default:
      return '全局记忆';
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

export default function InlineMemoryCandidate({
  candidate,
  isMutating,
  onAccept,
  onDefer,
  onDismiss,
}: InlineMemoryCandidateProps) {
  return (
    <div className="inline-memory-card">
      <div className="inline-memory-head">
        <span>{getScopeLabel(candidate.scope)}</span>
        <span>{getActionLabel(candidate.action)}</span>
      </div>
      <p className="inline-memory-content">{candidate.content}</p>
      {candidate.reason ? <p className="inline-memory-reason">{candidate.reason}</p> : null}
      <div className="inline-memory-actions">
        <button type="button" onClick={() => onAccept(candidate)} disabled={isMutating}>
          保存
        </button>
        <button type="button" onClick={() => onDefer(candidate)} disabled={isMutating}>
          稍后
        </button>
        <button type="button" onClick={() => onDismiss(candidate)} disabled={isMutating}>
          忽略
        </button>
      </div>
    </div>
  );
}
