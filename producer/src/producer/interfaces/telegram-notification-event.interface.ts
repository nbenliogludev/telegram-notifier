import { TelegramParseMode } from '../dto/publish-telegram-notification.dto';

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

export interface TelegramNotificationEventPayload extends Record<string, unknown> {
  target: TelegramNotificationTarget;
  message: {
    text: string;
    parseMode?: TelegramParseMode;
    disableNotification?: boolean;
  };
  metadata?: Record<string, unknown>;
}
