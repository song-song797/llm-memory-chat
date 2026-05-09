import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import Icon from './Icons';
import {
  setMessageBridge,
  type MessageItem,
  type MessagePlacement,
  type MessageType,
} from '../services/message';

interface Notice extends MessageItem {
  visible: boolean;
  closing: boolean;
}

const ENTER_DURATION = 16;
const EXIT_DURATION = 320;
const STACK_PLACEMENTS: MessagePlacement[] = [
  'top',
  'top-left',
  'top-right',
  'bottom',
  'bottom-left',
  'bottom-right',
];

function getNoticeIconName(type: MessageType): string {
  switch (type) {
    case 'success':
      return 'check-circle';
    case 'warning':
      return 'danger-circle';
    case 'error':
      return 'close-circle';
    case 'info':
      return 'info-circle';
    case 'primary':
    default:
      return 'info-circle';
  }
}

export default function MessageProvider({ children }: PropsWithChildren) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticesRef = useRef<Notice[]>([]);
  const autoCloseTimers = useRef(new Map<string, number>());
  const enterTimers = useRef(new Map<string, number>());
  const removeTimers = useRef(new Map<string, number>());

  useEffect(() => {
    noticesRef.current = notices;
  }, [notices]);

  const clearAutoCloseTimer = useCallback((id: string) => {
    const timer = autoCloseTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      autoCloseTimers.current.delete(id);
    }
  }, []);

  const clearEnterTimer = useCallback((id: string) => {
    const timer = enterTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      enterTimers.current.delete(id);
    }
  }, []);

  const clearRemoveTimer = useCallback((id: string) => {
    const timer = removeTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      removeTimers.current.delete(id);
    }
  }, []);

  const removeNotice = useCallback(
    (id: string) => {
      clearAutoCloseTimer(id);
      clearEnterTimer(id);
      clearRemoveTimer(id);
      setNotices((prev) => prev.filter((item) => item.id !== id));
    },
    [clearAutoCloseTimer, clearEnterTimer, clearRemoveTimer]
  );

  const closeNotice = useCallback(
    (id: string) => {
      const target = noticesRef.current.find((item) => item.id === id);
      if (!target || target.closing) {
        return;
      }

      clearAutoCloseTimer(id);
      clearEnterTimer(id);
      clearRemoveTimer(id);

      setNotices((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                visible: false,
                closing: true,
              }
            : item
        )
      );

      const timer = window.setTimeout(() => {
        removeNotice(id);
      }, EXIT_DURATION);

      removeTimers.current.set(id, timer);
    },
    [clearAutoCloseTimer, clearEnterTimer, clearRemoveTimer, removeNotice]
  );

  const openNotice = useCallback(
    (item: MessageItem) => {
      clearAutoCloseTimer(item.id);
      clearEnterTimer(item.id);
      clearRemoveTimer(item.id);

      setNotices((prev) => [
        ...prev.filter((notice) => notice.id !== item.id),
        {
          ...item,
          visible: false,
          closing: false,
        },
      ]);

      const enterTimer = window.setTimeout(() => {
        setNotices((prev) =>
          prev.map((notice) =>
            notice.id === item.id
              ? {
                  ...notice,
                  visible: true,
                  closing: false,
                }
              : notice
          )
        );
        enterTimers.current.delete(item.id);
      }, ENTER_DURATION);

      enterTimers.current.set(item.id, enterTimer);

      if (item.duration > 0) {
        const timer = window.setTimeout(() => {
          closeNotice(item.id);
        }, item.duration);

        autoCloseTimers.current.set(item.id, timer);
      }
    },
    [clearAutoCloseTimer, clearEnterTimer, clearRemoveTimer, closeNotice]
  );

  const closeAllNotices = useCallback(() => {
    noticesRef.current.forEach((notice) => {
      closeNotice(notice.id);
    });
  }, [closeNotice]);

  useEffect(() => {
    setMessageBridge({
      open: openNotice,
      close: closeNotice,
      closeAll: closeAllNotices,
    });

    return () => {
      setMessageBridge(null);

      autoCloseTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      autoCloseTimers.current.clear();

      enterTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      enterTimers.current.clear();

      removeTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      removeTimers.current.clear();
    };
  }, [closeAllNotices, closeNotice, openNotice]);

  const noticesByPlacement = useMemo(() => {
    return STACK_PLACEMENTS.reduce<Record<MessagePlacement, Notice[]>>(
      (grouped, placement) => {
        grouped[placement] = notices.filter((notice) => notice.placement === placement);
        return grouped;
      },
      {
        top: [],
        'top-left': [],
        'top-right': [],
        bottom: [],
        'bottom-left': [],
        'bottom-right': [],
      }
    );
  }, [notices]);

  return (
    <>
      {children}
      <div className="message-layer" aria-live="polite" aria-atomic="false">
        {STACK_PLACEMENTS.map((placement) => {
          const placementNotices = noticesByPlacement[placement];

          if (placementNotices.length === 0) {
            return null;
          }

          const directionClass = placement.startsWith('bottom') ? 'is-bottom' : 'is-top';

          return (
            <div
              key={placement}
              className={`message-stack message-stack--${placement} ${directionClass}`}
            >
              {placementNotices.map((notice) => (
                <div
                  key={notice.id}
                  className={`message-item ${directionClass} ${
                    notice.visible ? 'is-visible' : ''
                  } ${notice.closing ? 'is-closing' : ''}`}
                >
                  <div className={`message-card message-card--${notice.type}`} role="status">
                    <span className={`message-card-icon message-card-icon--${notice.type}`}>
                      <Icon name={getNoticeIconName(notice.type)} />
                    </span>
                    <div className="message-card-content">{notice.content}</div>
                    {notice.showClose ? (
                      <button
                        type="button"
                        className="message-card-close"
                        aria-label="关闭消息"
                        onClick={() => closeNotice(notice.id)}
                      >
                        <Icon name="close" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
