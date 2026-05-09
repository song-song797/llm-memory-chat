import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import hljs from 'highlight.js/lib/common';
import { codeToHtml } from 'shiki';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { fetchAttachmentBlobUrl } from '../services/api';
import type {
  Attachment,
  ComposerAttachment,
  Conversation,
  MemoryCandidate,
  Message,
  ModelOption,
  ReasoningLevel,
} from '../types';
import { message } from '../services/message';
import ChatInput from './ChatInput';
import Icon from './Icons';
import InlineMemoryCandidate from './InlineMemoryCandidate';
import ModelPickerPopover from './ModelPickerPopover';

interface ChatWindowProps {
  conversationId: string | null;
  messages: Message[];
  activeProjectName: string | null;
  projectConversations: Conversation[];
  streamingContent: string;
  isStreaming: boolean;
  streamingStartedAt: number | null;
  errorMessage: string;
  currentModelLabel: string;
  modelOptions: ModelOption[];
  selectedModel: string;
  selectedModelOption: ModelOption | null;
  reasoningLevel: ReasoningLevel;
  isModelPickerOpen: boolean;
  inlineCandidate: MemoryCandidate | null;
  isMemoryMutating: boolean;
  onSend: (payload: { message: string; attachments: ComposerAttachment[] }) => void;
  onStopStreaming: () => void;
  onToggleModelPicker: () => void;
  onCloseModelPicker: () => void;
  onModelChange: (value: string) => void;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
  onSelectConversation: (id: string) => void;
  onAcceptInlineCandidate: (candidate: MemoryCandidate) => void;
  onDeferInlineCandidate: (candidate: MemoryCandidate) => void;
  onDismissInlineCandidate: (candidate: MemoryCandidate) => void;
  onRegenerate: (messageId: string) => void;
  onSwitchVersion: (messageId: string, versionNumber: number) => void;
  messageVersions: Record<string, { total: number; currentVersion: number }>;
  regeneratingMessageId: string | null;
}

type ThreadActionKey = 'copy' | 'refresh' | 'read' | 'like' | 'dislike' | 'share' | 'more';

interface ThreadActionConfig {
  key: ThreadActionKey;
  icon: string;
  tooltip: string;
  ariaLabel: string;
  activeIcon?: string;
  activeAriaLabel?: string;
}

const featureStacks = [
  {
    title: 'Explore',
    body: 'Learn how to use chat.ai platform for your needs',
    icon: 'globe' as const,
  },
  {
    title: 'Capabilities',
    body: 'How much capable chat.ai to full-fill your needs',
    icon: 'flash' as const,
  },
  {
    title: 'Limitation',
    body: 'How much capable chat.ai to full-fill your needs',
    icon: 'warning' as const,
  },
];

const featureCards = [
  {
    title: '"Explain"',
    body: 'Quantum computing in simple terms',
  },
  {
    title: '"How to"',
    body: 'Make a search engine platform like google',
  },
  {
    title: '"Remember"',
    body: 'quantum computing in simple terms',
  },
  {
    title: '"Allows"',
    body: 'User to provide follow-up corrections',
  },
  {
    title: '"May"',
    body: 'Occasionally generate incorrect information',
  },
  {
    title: '"Limited"',
    body: 'Knowledge of world and events after 2021',
  },
];

const WELCOME_TITLE = 'Good day! How may I assist you today?';
const AUTO_SCROLL_THRESHOLD = 80;
const PREVIEW_ZOOM_STEP = 0.18;
const PREVIEW_MIN_ZOOM = 0.4;
const PREVIEW_MAX_ZOOM = 8;
const PREVIEW_ROTATION_STEP = 90;
const CODE_HIGHLIGHT_CACHE = new Map<string, string>();
const THREAD_ACTIONS: ThreadActionConfig[] = [
  {
    key: 'copy',
    icon: 'copy',
    activeIcon: 'check-circle',
    tooltip: 'Copy',
    ariaLabel: 'Copy answer',
    activeAriaLabel: 'Copied',
  },
  {
    key: 'refresh',
    icon: 'refresh',
    tooltip: 'Regenerate',
    ariaLabel: 'Refresh answer',
  },
  {
    key: 'read',
    icon: 'volume-loud',
    tooltip: 'Read aloud',
    ariaLabel: 'Read answer aloud',
  },
  {
    key: 'like',
    icon: 'thumb',
    tooltip: 'Like',
    ariaLabel: 'Like answer',
  },
  {
    key: 'dislike',
    icon: 'thumb-down',
    tooltip: 'Dislike',
    ariaLabel: 'Dislike answer',
  },
  {
    key: 'share',
    icon: 'share',
    tooltip: 'Share',
    ariaLabel: 'Share answer',
  },
  {
    key: 'more',
    icon: 'more-1',
    tooltip: 'More',
    ariaLabel: 'More actions',
  },
];

function formatProjectConversationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

const USER_THREAD_ACTIONS: ThreadActionConfig[] = [
  {
    key: 'copy',
    icon: 'copy',
    activeIcon: 'check-circle',
    tooltip: 'Copy',
    ariaLabel: 'Copy message',
    activeAriaLabel: 'Copied',
  },
  {
    key: 'share',
    icon: 'share',
    tooltip: 'Share',
    ariaLabel: 'Share message',
  },
  {
    key: 'more',
    icon: 'more-1',
    tooltip: 'More',
    ariaLabel: 'More actions',
  },
];

function normalizeMarkdownContent(content: string) {
  let normalized = content;

  normalized = normalized.replace(/\*\*"([^*]+?)"\*\*/g, '"**$1**"');
  normalized = normalized.replace(/\*\*'([^*]+?)'\*\*/g, "'**$1**'");
  normalized = normalized.replace(/\*\*\u201c([^*]+?)\u201d\*\*/g, '\u201c**$1**\u201d');
  normalized = normalized.replace(/\*\*\u2018([^*]+?)\u2019\*\*/g, '\u2018**$1**\u2019');

  return normalized;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveNearestRotationTarget(current: number, desired: number) {
  const turns = Math.round((current - desired) / 360);
  let target = desired + turns * 360;

  if (target - current > 180) {
    target -= 360;
  } else if (current - target > 180) {
    target += 360;
  }

  return target;
}

function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function formatCodeLanguage(language: string | null) {
  if (!language) {
    return 'Code';
  }

  const normalized = language.trim().toLowerCase();
  const labels: Record<string, string> = {
    bash: 'Bash',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    css: 'CSS',
    go: 'Go',
    golang: 'Go',
    html: 'HTML',
    java: 'Java',
    javascript: 'JavaScript',
    js: 'JavaScript',
    json: 'JSON',
    jsx: 'JSX',
    kotlin: 'Kotlin',
    markdown: 'Markdown',
    md: 'Markdown',
    php: 'PHP',
    powershell: 'PowerShell',
    py: 'Python',
    python: 'Python',
    ruby: 'Ruby',
    rs: 'Rust',
    rust: 'Rust',
    sh: 'Shell',
    shell: 'Shell',
    sql: 'SQL',
    swift: 'Swift',
    ts: 'TypeScript',
    tsx: 'TSX',
    typescript: 'TypeScript',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
  };

  return labels[normalized] ?? normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function detectCodeLanguage(code: string, language: string | null) {
  const explicitLanguage = language?.trim().toLowerCase() ?? '';

  if (explicitLanguage && hljs.getLanguage(explicitLanguage)) {
    return explicitLanguage;
  }

  const autoDetected = hljs.highlightAuto(code.replace(/\n$/, ''));

  return autoDetected.language ?? (explicitLanguage || null);
}

const CodeBlock = memo(function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string | null;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const detectedLanguage = useMemo(() => detectCodeLanguage(code, language), [code, language]);
  const languageLabel = useMemo(
    () => formatCodeLanguage(detectedLanguage ?? language),
    [detectedLanguage, language]
  );
  const cacheKey = useMemo(() => `${detectedLanguage ?? 'text'}\u0000${code}`, [code, detectedLanguage]);
  const [highlightedHtml, setHighlightedHtml] = useState(() => CODE_HIGHLIGHT_CACHE.get(cacheKey) ?? '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        copyTimerRef.current = null;
      }, 1200);
    } catch {
      message.error({
        content: 'Failed to copy code',
        placement: 'top',
      });
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const cachedHtml = CODE_HIGHLIGHT_CACHE.get(cacheKey);

    if (cachedHtml) {
      setHighlightedHtml(cachedHtml);
      return () => {
        isCancelled = true;
        if (copyTimerRef.current) {
          window.clearTimeout(copyTimerRef.current);
        }
      };
    }

    setHighlightedHtml('');

    void codeToHtml(code, {
      lang: detectedLanguage ?? 'text',
      theme: 'github-dark',
    })
      .then((html) => {
        if (!isCancelled) {
          CODE_HIGHLIGHT_CACHE.set(cacheKey, html);
          setHighlightedHtml(html);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHighlightedHtml('');
        }
      });

    return () => {
      isCancelled = true;
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, [cacheKey, code, detectedLanguage]);

  return (
    <div className="thread-code-block">
      <div className="thread-code-block-head">
        <div className="thread-code-block-meta">
          <span className="thread-code-block-icon" aria-hidden="true">
            <Icon name="code" />
          </span>
          <span className="thread-code-block-language">{languageLabel}</span>
        </div>
        <button
          type="button"
          className={`thread-code-block-copy ${isCopied ? 'is-copied' : ''}`}
          aria-label={isCopied ? 'Copied' : 'Copy code'}
          onClick={handleCopy}
        >
          <Icon name={isCopied ? 'check-circle' : 'copy'} />
        </button>
      </div>
      <div className="thread-code-block-body">
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
});

const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  const normalizedContent = useMemo(() => normalizeMarkdownContent(content), [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ className, children, ...props }) {
          const code = String(children).replace(/\n$/, '');
          const languageMatch = /language-([\w-]+)/.exec(className ?? '');
          const language = languageMatch?.[1] ?? null;
          const isBlock = Boolean(languageMatch) || code.includes('\n');

          if (!isBlock) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }

          return <CodeBlock code={code} language={language} />;
        },
      }}
    >
      {normalizedContent}
    </ReactMarkdown>
  );
});

function AttachmentImage({
  attachment,
  onPreview,
}: {
  attachment: Attachment;
  onPreview: (preview: { url: string; name: string }) => void;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let objectUrlToRevoke: string | null = null;

    setResolvedUrl(null);
    setHasError(false);

    void fetchAttachmentBlobUrl(attachment.content_url)
      .then(({ url, revokeOnCleanup }) => {
        if (isCancelled) {
          if (revokeOnCleanup) {
            URL.revokeObjectURL(url);
          }
          return;
        }

        if (revokeOnCleanup) {
          objectUrlToRevoke = url;
        }

        setResolvedUrl(url);
      })
      .catch(() => {
        if (!isCancelled) {
          setHasError(true);
        }
      });

    return () => {
      isCancelled = true;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [attachment.content_url]);

  if (hasError) {
    return <div className="thread-image-placeholder">{"\u56fe\u7247\u52a0\u8f7d\u5931\u8d25"}</div>;
  }

  if (!resolvedUrl) {
    return <div className="thread-image-placeholder">{"\u56fe\u7247\u52a0\u8f7d\u4e2d..."}</div>;
  }

  return (
    <button
      type="button"
      className="thread-image-button"
      onClick={() => onPreview({ url: resolvedUrl, name: attachment.name })}
      aria-label={`Preview ${attachment.name}`}
    >
      <img src={resolvedUrl} alt={attachment.name} />
    </button>
  );
}

function AttachmentGallery({
  attachments,
  onPreview,
}: {
  attachments: Attachment[];
  onPreview: (preview: { url: string; name: string }) => void;
}) {
  if (attachments.length === 0) {
    return null;
  }

  const imageAttachments = attachments.filter((attachment) => attachment.kind === 'image');
  const fileAttachments = attachments.filter((attachment) => attachment.kind !== 'image');

  return (
    <div className={`thread-attachments ${imageAttachments.length > 0 ? 'has-images' : ''}`}>
      {imageAttachments.length > 0 ? (
        <div className="thread-image-grid">
          {imageAttachments.map((attachment) => (
            <div key={attachment.id} className="thread-image-card">
              <AttachmentImage attachment={attachment} onPreview={onPreview} />
            </div>
          ))}
        </div>
      ) : null}
      {fileAttachments.length > 0 ? (
        <div className="thread-file-list">
          {fileAttachments.map((attachment) => (
            <a
              key={attachment.id}
              className="thread-file-card"
              href={attachment.content_url}
              target="_blank"
              rel="noreferrer"
              download={attachment.name}
            >
              <span className="thread-file-icon">
                <Icon name="link" />
              </span>
              <span className="thread-file-copy">
                <strong>{attachment.name}</strong>
                <span>{formatAttachmentSize(attachment.size_bytes)}</span>
              </span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ImagePreviewOverlay({
  preview,
  onClose,
}: {
  preview: { url: string; name: string };
  onClose: () => void;
}) {
  const [isImageReady, setIsImageReady] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const previewDialogRef = useRef<HTMLDivElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLImageElement>(null);
  const previewReadoutRef = useRef<HTMLDivElement>(null);
  const previewAnimationFrameRef = useRef<number | null>(null);
  const previewTransformRef = useRef({ x: 0, y: 0, zoom: 1, rotation: 0 });
  const previewTargetRef = useRef({ x: 0, y: 0, zoom: 1, rotation: 0 });
  const previewZoomReadoutRef = useRef(100);
  const previewDragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const updatePreviewReadout = (zoom: number) => {
    const nextReadout = Math.round(zoom * 100);
    if (previewZoomReadoutRef.current === nextReadout) {
      return;
    }

    previewZoomReadoutRef.current = nextReadout;
    if (previewReadoutRef.current) {
      previewReadoutRef.current.textContent = `${nextReadout}%`;
    }
  };

  const applyPreviewTransform = (transform: { x: number; y: number; zoom: number; rotation: number }) => {
    if (previewFrameRef.current) {
      previewFrameRef.current.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.zoom})`;
    }

    if (previewImageRef.current) {
      previewImageRef.current.style.transform = `translate3d(0, 0, 0) rotate(${transform.rotation}deg)`;
    }
  };

  const commitPreviewTransform = (transform: {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
  }) => {
    stopPreviewAnimation();
    previewTransformRef.current = transform;
    previewTargetRef.current = transform;
    applyPreviewTransform(transform);
    updatePreviewReadout(transform.zoom);
  };

  const animatePreviewTransform = () => {
    previewAnimationFrameRef.current = null;

    const current = previewTransformRef.current;
    const target = previewTargetRef.current;
    const nextZoom = current.zoom + (target.zoom - current.zoom) * 0.22;
    const nextRotation = current.rotation + (target.rotation - current.rotation) * 0.18;
    const zoomSettled = Math.abs(target.zoom - current.zoom) < 0.0025;
    const rotationSettled = Math.abs(target.rotation - current.rotation) < 0.12;
    const nextTransform = {
      x: Number((current.x + (target.x - current.x) * 0.34).toFixed(2)),
      y: Number((current.y + (target.y - current.y) * 0.34).toFixed(2)),
      zoom: zoomSettled ? target.zoom : Number(nextZoom.toFixed(4)),
      rotation: rotationSettled ? target.rotation : Number(nextRotation.toFixed(4)),
    };
    const xSettled = Math.abs(target.x - current.x) < 0.35;
    const ySettled = Math.abs(target.y - current.y) < 0.35;

    if (xSettled) {
      nextTransform.x = target.x;
    }

    if (ySettled) {
      nextTransform.y = target.y;
    }

    previewTransformRef.current = nextTransform;
    applyPreviewTransform(nextTransform);
    updatePreviewReadout(nextTransform.zoom);

    if (!zoomSettled || !rotationSettled || !xSettled || !ySettled) {
      previewAnimationFrameRef.current = window.requestAnimationFrame(animatePreviewTransform);
      return;
    }
  };

  const queuePreviewTransform = (
    updater: (current: { x: number; y: number; zoom: number; rotation: number }) => {
      x: number;
      y: number;
      zoom: number;
      rotation: number;
    }
  ) => {
    const nextTarget = updater(previewTargetRef.current);
    previewTargetRef.current = {
      x: Number(nextTarget.x.toFixed(2)),
      y: Number(nextTarget.y.toFixed(2)),
      zoom: clamp(Number(nextTarget.zoom.toFixed(2)), PREVIEW_MIN_ZOOM, PREVIEW_MAX_ZOOM),
      rotation: Number(nextTarget.rotation.toFixed(2)),
    };

    if (previewAnimationFrameRef.current !== null) {
      return;
    }

    previewAnimationFrameRef.current = window.requestAnimationFrame(animatePreviewTransform);
  };

  const stopPreviewAnimation = () => {
    if (previewAnimationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(previewAnimationFrameRef.current);
    previewAnimationFrameRef.current = null;
  };

  const resolvePreviewAnchor = (clientX?: number, clientY?: number) => {
    const stage = previewStageRef.current;
    if (!stage) {
      return { x: 0, y: 0 };
    }

    const rect = stage.getBoundingClientRect();
    const anchorX = clientX ?? rect.left + rect.width / 2;
    const anchorY = clientY ?? rect.top + rect.height / 2;

    return {
      x: anchorX - rect.left - rect.width / 2,
      y: anchorY - rect.top - rect.height / 2,
    };
  };

  const buildZoomTransform = (
    current: { x: number; y: number; zoom: number; rotation: number },
    zoomFactor: number,
    anchor: { x: number; y: number }
  ) => {
    const nextZoom = clamp(Number((current.zoom * zoomFactor).toFixed(4)), PREVIEW_MIN_ZOOM, PREVIEW_MAX_ZOOM);
    const appliedFactor = nextZoom / current.zoom;

    return {
      ...current,
      zoom: nextZoom,
      x: Number((anchor.x - (anchor.x - current.x) * appliedFactor).toFixed(2)),
      y: Number((anchor.y - (anchor.y - current.y) * appliedFactor).toFixed(2)),
    };
  };

  const handlePreviewZoom = (delta: number, clientX?: number, clientY?: number) => {
    const anchor = resolvePreviewAnchor(clientX, clientY);
    const zoomFactor = 1 + delta;

    queuePreviewTransform((current) => buildZoomTransform(current, zoomFactor, anchor));
  };

  const handlePreviewRotate = (delta: number) => {
    queuePreviewTransform((current) => ({
      ...current,
      rotation: current.rotation + delta,
    }));
  };

  const handlePreviewReset = () => {
    queuePreviewTransform((current) => ({
      x: 0,
      y: 0,
      zoom: 1,
      rotation: resolveNearestRotationTarget(current.rotation, 0),
    }));
  };

  const handlePreviewDownload = () => {
    const link = document.createElement('a');
    link.href = preview.url;
    link.download = preview.name || 'preview-image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateExpandedZoom = () => {
    const stage = previewStageRef.current;
    const image = previewImageRef.current;
    if (!stage || !image) {
      return 1;
    }

    const availableWidth = Math.max(0, stage.clientWidth - 32);
    const availableHeight = Math.max(0, stage.clientHeight - 32);
    const rotationTurns = Math.abs(Math.round(previewTransformRef.current.rotation / 90)) % 2;
    const naturalWidth = rotationTurns === 0 ? image.naturalWidth : image.naturalHeight;
    const naturalHeight = rotationTurns === 0 ? image.naturalHeight : image.naturalWidth;
    const baseScale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    const baseWidth = naturalWidth * baseScale;
    const baseHeight = naturalHeight * baseScale;

    if (baseWidth === 0 || baseHeight === 0) {
      return 1;
    }

    return clamp(
      Number(Math.min(availableWidth / baseWidth, availableHeight / baseHeight).toFixed(4)),
      PREVIEW_MIN_ZOOM,
      PREVIEW_MAX_ZOOM
    );
  };

  const handleClosePreview = async () => {
    onClose();
  };

  const handlePreviewExpand = () => {
    if (isPreviewExpanded) {
      setIsPreviewExpanded(false);
      queuePreviewTransform((current) => ({
        ...current,
        x: 0,
        y: 0,
        zoom: 1,
      }));
      return;
    }

    const expandedZoom = calculateExpandedZoom();
    if (!expandedZoom) {
      return;
    }

    setIsPreviewExpanded(true);
    queuePreviewTransform((current) => ({
      ...current,
      x: 0,
      y: 0,
      zoom: expandedZoom,
    }));
  };

  const handlePreviewWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const zoomFactor = Math.exp(-event.deltaY * 0.0012);
    if (Math.abs(zoomFactor - 1) < 0.001) {
      return;
    }

    const anchor = resolvePreviewAnchor(event.clientX, event.clientY);
    commitPreviewTransform(buildZoomTransform(previewTransformRef.current, zoomFactor, anchor));
  };

  const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isImageReady || event.button !== 0) {
      return;
    }

    event.preventDefault();
    stopPreviewAnimation();
    previewDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: previewTransformRef.current.x,
      originY: previewTransformRef.current.y,
    };

    if (previewStageRef.current) {
      previewStageRef.current.dataset.dragging = 'true';
    }

    previewStageRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = previewDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const nextX = dragState.originX + (event.clientX - dragState.startX);
    const nextY = dragState.originY + (event.clientY - dragState.startY);
    const nextTransform = {
      ...previewTransformRef.current,
      x: Number(nextX.toFixed(2)),
      y: Number(nextY.toFixed(2)),
    };

    commitPreviewTransform(nextTransform);
  };

  const handlePreviewPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (previewDragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    previewDragStateRef.current = null;
    if (previewStageRef.current) {
      delete previewStageRef.current.dataset.dragging;
    }
    if (previewStageRef.current?.hasPointerCapture(event.pointerId)) {
      previewStageRef.current.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    previewTransformRef.current = { x: 0, y: 0, zoom: 1, rotation: 0 };
    previewTargetRef.current = { x: 0, y: 0, zoom: 1, rotation: 0 };
    previewZoomReadoutRef.current = 100;
    previewDragStateRef.current = null;
    setIsPreviewExpanded(false);
    if (previewReadoutRef.current) {
      previewReadoutRef.current.textContent = '100%';
    }
    applyPreviewTransform(previewTransformRef.current);

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setIsImageReady(false);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void handleClosePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previewAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(previewAnimationFrameRef.current);
      }
      previewDragStateRef.current = null;
      if (previewStageRef.current) {
        delete previewStageRef.current.dataset.dragging;
      }
    };
  }, [preview.url]);

  return createPortal(
    <div className="thread-image-preview-layer" role="presentation">
      <button
        type="button"
        className="thread-image-preview-backdrop"
        aria-label="Close image preview"
        onClick={() => {
          void handleClosePreview();
        }}
      />
      <div
        ref={previewDialogRef}
        className="thread-image-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={preview.name || 'Image preview'}
      >
        <button
          type="button"
          className="thread-image-preview-close"
          aria-label="Close image preview"
          onClick={() => {
            void handleClosePreview();
          }}
        >
          <Icon name="close" />
        </button>
        <div
          ref={previewStageRef}
          className={`thread-image-preview-stage ${isImageReady ? '' : 'is-loading'}`}
          onDragStart={(event) => {
            event.preventDefault();
          }}
          onWheel={handlePreviewWheel}
          onPointerMove={handlePreviewPointerMove}
          onPointerDown={handlePreviewPointerDown}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerUp}
        >
          <div className="thread-image-preview-media-frame" ref={previewFrameRef}>
            <img
              ref={previewImageRef}
              className="thread-image-preview-media"
              src={preview.url}
              alt={preview.name}
              decoding="async"
              draggable={false}
              onDragStart={(event) => {
                event.preventDefault();
              }}
              onLoad={() => {
                setIsImageReady(true);
                applyPreviewTransform(previewTransformRef.current);
              }}
            />
          </div>
          {!isImageReady ? (
            <div className="thread-image-preview-loading">图片加载中...</div>
          ) : null}
        </div>
        <div className="thread-image-preview-toolbar" role="toolbar" aria-label="Image controls">
          <button
            type="button"
            className="thread-image-preview-tool"
            aria-label="Zoom out"
            onClick={() => handlePreviewZoom(-PREVIEW_ZOOM_STEP)}
          >
            <Icon name="zoom-out" />
          </button>
          <div className="thread-image-preview-readout" ref={previewReadoutRef}>
            100%
          </div>
          <button
            type="button"
            className="thread-image-preview-tool"
            aria-label="Zoom in"
            onClick={() => handlePreviewZoom(PREVIEW_ZOOM_STEP)}
          >
            <Icon name="zoom-in" />
          </button>
          <span className="thread-image-preview-divider" aria-hidden="true" />
          <button
            type="button"
            className="thread-image-preview-tool"
            aria-label="Rotate left"
            onClick={() => handlePreviewRotate(-PREVIEW_ROTATION_STEP)}
          >
            <Icon name="rotate-left" />
          </button>
          <button
            type="button"
            className="thread-image-preview-tool"
            aria-label="Rotate right"
            onClick={() => handlePreviewRotate(PREVIEW_ROTATION_STEP)}
          >
            <Icon name="rotate-right" />
          </button>
          <button
            type="button"
            className="thread-image-preview-tool"
            aria-label="Reset preview"
            onClick={handlePreviewReset}
          >
            <Icon name="refresh" />
          </button>
          <span className="thread-image-preview-divider" aria-hidden="true" />
          <button
            type="button"
            className="thread-image-preview-tool"
            aria-label={isPreviewExpanded ? 'Exit page fit' : 'Fit image to page'}
            onClick={handlePreviewExpand}
          >
            <Icon name="fullscreen" />
          </button>
          <button
            type="button"
            className="thread-image-preview-tool"
            aria-label="Download image"
            onClick={handlePreviewDownload}
          >
            <Icon name="download" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ChatWindow({
  conversationId,
  messages,
  activeProjectName,
  projectConversations,
  streamingContent,
  isStreaming,
  streamingStartedAt,
  errorMessage,
  currentModelLabel,
  modelOptions,
  selectedModel,
  selectedModelOption,
  reasoningLevel,
  isModelPickerOpen,
  inlineCandidate,
  isMemoryMutating,
  onSend,
  onStopStreaming,
  onToggleModelPicker,
  onCloseModelPicker,
  onModelChange,
  onReasoningLevelChange,
  onSelectConversation,
  onAcceptInlineCandidate,
  onDeferInlineCandidate,
  onDismissInlineCandidate,
  onRegenerate,
  onSwitchVersion,
  messageVersions,
  regeneratingMessageId,
}: ChatWindowProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const lastErrorMessageRef = useRef('');
  const previousConversationIdRef = useRef<string | null>(conversationId);
  const pendingConversationScrollRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const actionFeedbackTimerRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [typedWelcomeTitle, setTypedWelcomeTitle] = useState('');
  const [activeActionFeedback, setActiveActionFeedback] = useState<{
    messageId: string;
    action: ThreadActionKey;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const showActionFeedback = (messageId: string, action: ThreadActionKey) => {
    setActiveActionFeedback({ messageId, action });

    if (actionFeedbackTimerRef.current) {
      window.clearTimeout(actionFeedbackTimerRef.current);
    }

    actionFeedbackTimerRef.current = window.setTimeout(() => {
      setActiveActionFeedback((current) =>
        current?.messageId === messageId && current.action === action ? null : current
      );
      actionFeedbackTimerRef.current = null;
    }, 1400);
  };

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showActionFeedback(messageId, 'copy');
      return;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error('execCommand copy returned false');
        }

        showActionFeedback(messageId, 'copy');
      } catch {
        message.error({
          content: 'Failed to copy message',
          placement: 'top',
        });
      }
    }
  };

  useEffect(() => {
    return () => {
      if (actionFeedbackTimerRef.current) {
        window.clearTimeout(actionFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousConversationIdRef.current === conversationId) return;

    previousConversationIdRef.current = conversationId;
    pendingConversationScrollRef.current = true;
    setActiveActionFeedback(null);
  }, [conversationId]);

  useLayoutEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    if (pendingConversationScrollRef.current) {
      container.scrollTop = container.scrollHeight;
      shouldAutoScrollRef.current = true;
      pendingConversationScrollRef.current = false;
      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: isStreaming ? 'auto' : 'smooth',
    });
  }, [messages, streamingContent, isStreaming]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const distanceToBottom =
        container.scrollHeight - currentScrollTop - container.clientHeight;

      if (isStreaming && currentScrollTop < lastScrollTopRef.current) {
        shouldAutoScrollRef.current = false;
      } else if (distanceToBottom <= AUTO_SCROLL_THRESHOLD) {
        shouldAutoScrollRef.current = true;
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);

    return () => container.removeEventListener('scroll', handleScroll);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming || !streamingStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - streamingStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isStreaming, streamingStartedAt]);

  const showEmpty = messages.length === 0 && !isStreaming;
  const showProjectHome = showEmpty && Boolean(activeProjectName);
  const showWelcomeHome = showEmpty && !showProjectHome;

  useEffect(() => {
    if (!showWelcomeHome) {
      setTypedWelcomeTitle(WELCOME_TITLE);
      return;
    }

    setTypedWelcomeTitle('');

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedWelcomeTitle(WELCOME_TITLE.slice(0, index));

      if (index >= WELCOME_TITLE.length) {
        window.clearInterval(timer);
      }
    }, 48);

    return () => window.clearInterval(timer);
  }, [showWelcomeHome]);

  useEffect(() => {
    if (!errorMessage) {
      lastErrorMessageRef.current = '';
      return;
    }

    if (lastErrorMessageRef.current === errorMessage) {
      return;
    }

    lastErrorMessageRef.current = errorMessage;

    message.error({
      content: errorMessage,
      placement: 'top',
    });
  }, [errorMessage]);

  return (
    <main className="chat-stage">
      <button
        type="button"
        className="chat-model-trigger"
        aria-label={`Current model ${currentModelLabel}`}
        aria-expanded={isModelPickerOpen}
        aria-haspopup="dialog"
        onClick={onToggleModelPicker}
      >
        <span>{currentModelLabel}</span>
        <Icon name="arrow-down" />
      </button>
      <ModelPickerPopover
        isOpen={isModelPickerOpen}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        selectedOption={selectedModelOption}
        reasoningLevel={reasoningLevel}
        onModelChange={onModelChange}
        onReasoningLevelChange={onReasoningLevelChange}
        onClose={onCloseModelPicker}
      />

      {showProjectHome && activeProjectName ? (
        <section className="project-home-stage">
          <div className="project-home-scroll">
            <div className="project-home-panel">
              <header className="project-home-head">
                <span className="project-home-eyebrow">当前项目</span>
                <h1>{activeProjectName}</h1>
              </header>

              <div className="project-home-composer">
                <ChatInput
                  onSend={onSend}
                  submitDisabled={false}
                  placeholder={`在 ${activeProjectName} 中开始新聊天`}
                />
              </div>

              <section className="project-home-chats" aria-label={`${activeProjectName} chats`}>
                <div className="project-home-tabs">
                  <span className="is-active">聊天</span>
                </div>

                {projectConversations.length > 0 ? (
                  <div className="project-home-chat-list">
                    {projectConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        className="project-home-chat-row"
                        onClick={() => onSelectConversation(conversation.id)}
                      >
                        <span className="project-home-chat-copy">
                          <strong>{conversation.title}</strong>
                        </span>
                        <span className="project-home-chat-date">
                          {formatProjectConversationDate(conversation.updated_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="project-home-empty">这个项目下面还没有聊天。</p>
                )}
              </section>
            </div>
          </div>
        </section>
      ) : showWelcomeHome ? (
        <section className="welcome-stage">
          <div className="welcome-scroll">
            <h1>
              <span
                className={`welcome-typewriter ${
                  typedWelcomeTitle === WELCOME_TITLE ? 'is-complete' : ''
                }`}
              >
                {typedWelcomeTitle}
              </span>
            </h1>

            <div className="welcome-grid">
              <div className="welcome-stack">
                {featureStacks.map((stack) => (
                  <div key={stack.title} className="welcome-stack-row">
                    <div className="welcome-stack-card">
                      <span className="welcome-stack-icon">
                        <Icon name={stack.icon} />
                      </span>
                      <strong>{stack.title}</strong>
                      <p>{stack.body}</p>
                    </div>
                    <div className="welcome-stack-divider">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ))}
              </div>

              <div className="welcome-card-grid">
                {featureCards.map((card) => (
                  <div key={card.title} className="welcome-card">
                    <div className="welcome-card-copy">
                      <strong>{card.title}</strong>
                      <p>{card.body}</p>
                    </div>
                    <span className="welcome-card-arrow">
                      <Icon name="arrow-right" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chat-composer-dock">
            <ChatInput onSend={onSend} submitDisabled={false} />
          </div>
        </section>
      ) : (
        <div className="thread-shell">
          <div className="thread-scroll" ref={messagesRef}>
            <div className="thread-inner">
              {messages.map((item) => {
                const isCopied =
                  activeActionFeedback?.messageId === item.id &&
                  activeActionFeedback.action === 'copy';
                const attachments = item.attachments ?? [];
                const hasUserText = item.content.trim().length > 0;

                return (
                  <article
                    key={item.id}
                    className={`thread-entry ${item.role === 'assistant' ? 'is-assistant' : 'is-user'}`}
                  >
                    {item.role === 'user' && (
                      <div className="thread-user-block">
                        <AttachmentGallery
                          attachments={attachments}
                          onPreview={setPreviewImage}
                        />
                        {hasUserText ? (
                          <div className="thread-head is-user">
                            <div className="thread-userline is-user">
                              <span className="thread-prompt thread-prompt--user">{item.content}</span>
                            </div>
                          </div>
                        ) : null}
                        {hasUserText ? (
                          <div className="thread-user-footer">
                            <div className={`thread-actions thread-user-actions ${isCopied ? 'is-visible' : ''}`}>
                              {USER_THREAD_ACTIONS.map((action) => {
                                const isActive =
                                  activeActionFeedback?.messageId === item.id &&
                                  activeActionFeedback.action === action.key;
                                const tooltip = isActive ? '' : action.tooltip;
                                const iconName =
                                  isActive && action.activeIcon ? action.activeIcon : action.icon;
                                const ariaLabel =
                                  isActive && action.activeAriaLabel
                                    ? action.activeAriaLabel
                                    : action.ariaLabel;

                                const handleClick = () => {
                                  if (action.key === 'copy') {
                                    return void handleCopy(item.id, item.content);
                                  }
                                };

                                return (
                                  <button
                                    key={action.key}
                                    type="button"
                                    className={`thread-action-pill ${isActive ? 'is-active' : ''}`}
                                    aria-label={ariaLabel}
                                    data-tooltip={tooltip}
                                    onClick={handleClick}
                                  >
                                    <Icon name={iconName} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {item.role === 'assistant' && (
                      <div className="thread-answer-wrap">
                        <AttachmentGallery
                          attachments={attachments}
                          onPreview={setPreviewImage}
                        />
                        <div className="thread-answer-card">
                          <div className="thread-label-row">
                            <span className="thread-brand-label">CHAT A.I+</span>
                            <span className="thread-brand-badge" />
                          </div>
                          <div className="thread-answer-body">
                            {regeneratingMessageId === item.id && isStreaming ? (
                              <>
                                {!streamingContent && (
                                  <span className="thread-streaming-hint">
                                    Thinking...
                                    {elapsedSeconds > 0 ? ` ${elapsedSeconds}s` : ''}
                                  </span>
                                )}
                                {streamingContent && <MarkdownMessage content={streamingContent} />}
                              </>
                            ) : (
                              <MarkdownMessage content={item.content} />
                            )}
                          </div>
                          <div className="thread-answer-footer">
                            <div className="thread-actions">
                              {THREAD_ACTIONS.map((action) => {
                                const isActive =
                                  activeActionFeedback?.messageId === item.id &&
                                  activeActionFeedback.action === action.key;
                                const tooltip = isActive ? '' : action.tooltip;
                                const iconName =
                                  isActive && action.activeIcon ? action.activeIcon : action.icon;
                                const ariaLabel =
                                  isActive && action.activeAriaLabel
                                    ? action.activeAriaLabel
                                    : action.ariaLabel;

                                const handleClick = () => {
                                  if (action.key === 'copy') {
                                    return void handleCopy(item.id, item.content);
                                  }
                                  if (action.key === 'refresh') {
                                    return onRegenerate(item.id);
                                  }
                                };

                                return (
                                  <button
                                    key={action.key}
                                    type="button"
                                    className={`thread-action-pill ${isActive ? 'is-active' : ''}`}
                                    aria-label={ariaLabel}
                                    data-tooltip={tooltip}
                                    onClick={handleClick}
                                    disabled={regeneratingMessageId === item.id && isStreaming}
                                  >
                                    <Icon name={iconName} />
                                  </button>
                                );
                              })}
                              {(() => {
                                const versionInfo = messageVersions[item.id];
                                if (!versionInfo || versionInfo.total <= 1) return null;
                                return (
                                  <div className="thread-version-switcher">
                                    <button
                                      type="button"
                                      className="thread-version-btn"
                                      aria-label="Previous version"
                                      disabled={versionInfo.currentVersion <= 1}
                                      onClick={() => onSwitchVersion(item.id, versionInfo.currentVersion - 1)}
                                    >
                                      <Icon name="arrow-left" />
                                    </button>
                                    <span className="thread-version-count">
                                      {versionInfo.currentVersion} / {versionInfo.total}
                                    </span>
                                    <button
                                      type="button"
                                      className="thread-version-btn"
                                      aria-label="Next version"
                                      disabled={versionInfo.currentVersion >= versionInfo.total}
                                      onClick={() => onSwitchVersion(item.id, versionInfo.currentVersion + 1)}
                                    >
                                      <Icon name="arrow-right" />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}

              {isStreaming && !regeneratingMessageId && (
                <article className="thread-entry is-assistant">
                  <div className="thread-head">
                    <div className="thread-userline">
                      <span className="thread-avatar assistant">AI</span>
                      <span className="thread-prompt">Generating a response...</span>
                    </div>
                  </div>
                  <div className="thread-answer-card">
                    <div className="thread-label-row">
                      <span className="thread-brand-label">CHAT A.I+</span>
                      <span className="thread-brand-badge" />
                    </div>
                    <div className="thread-answer-body">
                      {!streamingContent && (
                        <span className="thread-streaming-hint">
                          Thinking...
                          {elapsedSeconds > 0 ? ` ${elapsedSeconds}s` : ''}
                        </span>
                      )}
                      {streamingContent && <MarkdownMessage content={streamingContent} />}
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>
          <div className="chat-composer-dock">
            <ChatInput
              onSend={onSend}
              onStop={onStopStreaming}
              submitDisabled={isStreaming}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      )}
      {inlineCandidate && !isStreaming ? (
        <InlineMemoryCandidate
          candidate={inlineCandidate}
          isMutating={isMemoryMutating}
          onAccept={onAcceptInlineCandidate}
          onDefer={onDeferInlineCandidate}
          onDismiss={onDismissInlineCandidate}
        />
      ) : null}
      {previewImage ? (
        <ImagePreviewOverlay preview={previewImage} onClose={() => setPreviewImage(null)} />
      ) : null}
    </main>
  );
}
