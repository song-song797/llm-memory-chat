import type { ReactNode } from 'react';

export type MessagePlacement =
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right';

export type MessageType = 'primary' | 'success' | 'warning' | 'info' | 'error';

export interface MessageOptions {
  key?: string;
  content: ReactNode;
  type?: MessageType;
  placement?: string;
  duration?: number;
  showClose?: boolean;
}

export interface MessageItem {
  id: string;
  content: ReactNode;
  type: MessageType;
  placement: MessagePlacement;
  duration: number;
  showClose: boolean;
}

interface MessageBridge {
  open: (item: MessageItem) => void;
  close: (id: string) => void;
  closeAll: () => void;
}

interface MessageApi {
  (input: ReactNode | MessageOptions): string;
  open: (input: ReactNode | MessageOptions) => string;
  primary: (input: ReactNode | MessageOptions) => string;
  success: (input: ReactNode | MessageOptions) => string;
  warning: (input: ReactNode | MessageOptions) => string;
  info: (input: ReactNode | MessageOptions) => string;
  error: (input: ReactNode | MessageOptions) => string;
  destroy: (id?: string) => void;
}

let bridge: MessageBridge | null = null;
let seed = 0;
const pendingItems: MessageItem[] = [];

const DEFAULT_DURATION = 3000;

function createMessageId() {
  seed += 1;
  return `message-${Date.now()}-${seed}`;
}

function normalizePlacement(value?: string): MessagePlacement {
  const normalized = value?.trim().toLowerCase().replace(/[_\s]+/g, '-') ?? 'top';

  switch (normalized) {
    case 'top':
    case 'top-left':
    case 'top-right':
    case 'bottom':
    case 'bottom-left':
    case 'bottom-right':
      return normalized;
    case 'topleft':
      return 'top-left';
    case 'topright':
      return 'top-right';
    case 'bottomleft':
      return 'bottom-left';
    case 'bottomright':
      return 'bottom-right';
    default:
      return 'top';
  }
}

function normalizeDuration(value?: number): number {
  if (value === 0) {
    return 0;
  }

  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return DEFAULT_DURATION;
  }

  return value;
}

function isMessageOptions(input: ReactNode | MessageOptions): input is MessageOptions {
  return typeof input === 'object' && input !== null && 'content' in input;
}

function createMessageItem(
  input: ReactNode | MessageOptions,
  forcedType?: MessageType
): MessageItem {
  if (!isMessageOptions(input)) {
    return {
      id: createMessageId(),
      content: input,
      type: forcedType ?? 'primary',
      placement: 'top',
      duration: DEFAULT_DURATION,
      showClose: false,
    };
  }

  return {
    id: input.key?.trim() || createMessageId(),
    content: input.content,
    type: forcedType ?? input.type ?? 'primary',
    placement: normalizePlacement(input.placement),
    duration: normalizeDuration(input.duration),
    showClose: input.showClose === true,
  };
}

export function setMessageBridge(nextBridge: MessageBridge | null) {
  bridge = nextBridge;

  if (!bridge || pendingItems.length === 0) {
    return;
  }

  while (pendingItems.length > 0) {
    const item = pendingItems.shift();
    if (item) {
      bridge.open(item);
    }
  }
}

function dispatchOpen(input: ReactNode | MessageOptions, forcedType?: MessageType) {
  const item = createMessageItem(input, forcedType);

  if (bridge) {
    bridge.open(item);
  } else {
    pendingItems.push(item);
  }

  return item.id;
}

function dispatchClose(id?: string) {
  if (id) {
    pendingItems.splice(
      0,
      pendingItems.length,
      ...pendingItems.filter((item) => item.id !== id)
    );
    bridge?.close(id);
    return;
  }

  pendingItems.length = 0;
  bridge?.closeAll();
}

const messageApi = ((input: ReactNode | MessageOptions) => {
  return dispatchOpen(input, 'primary');
}) as MessageApi;

messageApi.open = (input) => dispatchOpen(input);
messageApi.primary = (input) => dispatchOpen(input, 'primary');
messageApi.success = (input) => dispatchOpen(input, 'success');
messageApi.warning = (input) => dispatchOpen(input, 'warning');
messageApi.info = (input) => dispatchOpen(input, 'info');
messageApi.error = (input) => dispatchOpen(input, 'error');
messageApi.destroy = (id?: string) => {
  dispatchClose(id);
};

export const message = messageApi;
