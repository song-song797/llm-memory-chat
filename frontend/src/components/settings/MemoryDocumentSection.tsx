import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Memory, MemoryDocument, MemoryScope } from '../../types';

interface MemoryDocumentSectionProps {
  title: string;
  scope: MemoryScope;
  document: MemoryDocument | null;
  memories: Memory[];
  draft: string;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
  isLoading: boolean;
  isMutating: boolean;
  onDraftChange: (value: string) => void;
  onCreate: () => void;
  onToggle: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
}

const KIND_LABELS: Record<string, string> = {
  preference: '偏好',
  project: '项目信息',
  tool: '工具与技术栈',
  decision: '已确认结论',
  fact: '事实',
};

function getActiveMemories(memories: Memory[]): Memory[] {
  return memories.filter((memory) => memory.enabled && memory.status !== 'archived');
}

function getDocumentSourceIds(document: MemoryDocument | null): Set<string> {
  if (!document?.source_memory_ids) return new Set();
  return new Set(document.source_memory_ids.split(',').filter(Boolean));
}

function shouldUseDocument(document: MemoryDocument | null, memories: Memory[]): boolean {
  if (!document || document.is_stale) return false;
  const activeMemories = getActiveMemories(memories);
  const sourceIds = getDocumentSourceIds(document);
  return activeMemories.every((memory) => sourceIds.has(memory.id)) && sourceIds.size === activeMemories.length;
}

function normalizeMemoryText(content: string): string {
  let text = content.trim().toLowerCase().replace(/\s+/g, '');
  text = text.replace(/^[-*•]+/, '').replace(/^(用户|我)/, '');
  text = text.replace(/[，。,.；;：:！!？?]+$/g, '');
  if (text.length > 2 && text.endsWith('了')) {
    text = text.slice(0, -1);
  }
  return text;
}

function preferenceTopicKey(content: string): string | null {
  const text = normalizeMemoryText(content);
  for (const marker of ['不喜欢', '喜欢', '偏好', '习惯']) {
    const markerIndex = text.indexOf(marker);
    if (markerIndex >= 0) {
      const topic = text.slice(markerIndex + marker.length).replace(/^[，。,.；;：:！!？?]+|[，。,.；;：:！!？?]+$/g, '');
      if (topic.length > 1) return `preference:${marker.replace(/^不/, '')}:${topic}`;
    }
  }
  return null;
}

function memoryDocumentKey(memory: Memory): string {
  if ((memory.kind || '') === 'preference') {
    const key = preferenceTopicKey(memory.content);
    if (key) return key;
  }
  return `${memory.kind || 'fact'}:${normalizeMemoryText(memory.content)}`;
}

function dedupeMemoriesForDocument(memories: Memory[]): Memory[] {
  const seen = new Set<string>();
  return memories.filter((memory) => {
    const key = memoryDocumentKey(memory);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackMarkdown(title: string, memories: Memory[], emptyLabel: string): string {
  const activeMemories = getActiveMemories(memories);
  if (activeMemories.length === 0) {
    return `# ${title}\n\n${emptyLabel}`;
  }

  const groups = new Map<string, Memory[]>();
  dedupeMemoriesForDocument(activeMemories).forEach((memory) => {
    const kind = memory.kind || 'fact';
    groups.set(kind, [...(groups.get(kind) ?? []), memory]);
  });

  const sections = [`# ${title}`];
  groups.forEach((items, kind) => {
    const lines = items.map((memory) => `- ${memory.content}`).join('\n');
    sections.push(`## ${KIND_LABELS[kind] ?? kind}\n${lines}`);
  });
  return sections.join('\n\n');
}

export default function MemoryDocumentSection({
  title,
  scope,
  document,
  memories,
  draft,
  placeholder,
  addLabel,
  emptyLabel,
  isLoading,
  isMutating,
  onDraftChange,
  onCreate,
  onToggle,
  onDelete,
}: MemoryDocumentSectionProps) {
  const activeMemories = getActiveMemories(memories);
  const content = shouldUseDocument(document, memories)
    ? document?.content_md ?? ''
    : buildFallbackMarkdown(title, memories, emptyLabel);
  const revisionLabel = document ? `第 ${document.revision} 版` : '本地预览';
  const generationLabel = document
    ? document.generated_by === 'ai'
      ? `AI整理${document.generation_model ? ` · ${document.generation_model}` : ''}`
      : '本地整理'
    : '本地预览';

  return (
    <section className="settings-section memory-document-section" data-scope={scope}>
      <div className="settings-section-head">
        <h3>{title}</h3>
        <span>{isLoading ? '加载中' : `已整理 ${activeMemories.length} 条 · ${revisionLabel} · ${generationLabel}`}</span>
      </div>

      <div className="memory-create-row">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onCreate();
          }}
          disabled={isLoading || isMutating}
        />
        <button type="button" onClick={onCreate} disabled={!draft.trim() || isLoading || isMutating}>
          {addLabel}
        </button>
      </div>

      <article className="memory-document-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>

      {memories.length > 0 ? (
        <details className="memory-source-details">
          <summary>高级：原始记忆记录</summary>
          <div className="memory-source-list">
            {memories.map((memory) => (
              <div key={memory.id} className="memory-source-row">
                <span>{KIND_LABELS[memory.kind] ?? memory.kind}</span>
                <p>{memory.content}</p>
                <div className="memory-source-actions">
                  <button type="button" onClick={() => onToggle(memory)} disabled={isLoading || isMutating}>
                    {memory.enabled ? '停用' : '启用'}
                  </button>
                  <button type="button" onClick={() => onDelete(memory)} disabled={isLoading || isMutating}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
