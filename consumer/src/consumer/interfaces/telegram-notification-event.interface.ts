export interface ConsumerEvent<TPayload = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  payload: TPayload;
}

export interface SingleTelegramNotificationTarget {
  type: 'single';
  chatId: string;
}

export interface BroadcastTelegramNotificationTarget {
  type: 'broadcast';
}

export type TelegramNotificationTarget =
  | SingleTelegramNotificationTarget
  | BroadcastTelegramNotificationTarget;

export interface TelegramNotificationEventPayload {
  target: TelegramNotificationTarget;
  message: {
    text: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
  };
  metadata?: Record<string, unknown>;
}
