import { Injectable, Logger } from '@nestjs/common';
import {
  ConsumerEvent,
  TelegramNotificationEventPayload,
} from './interfaces/telegram-notification-event.interface';
import { TelegramService } from './telegram.service';

const TELEGRAM_NOTIFICATION_REQUESTED_EVENT = 'telegram.notification.requested';

@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);

  constructor(private readonly telegramService: TelegramService) {}

  async process(event: ConsumerEvent): Promise<void> {
    if (event.type !== TELEGRAM_NOTIFICATION_REQUESTED_EVENT) {
      this.logger.warn(`Skipping unsupported event type: ${event.type}`);
      return;
    }

    const payload = event.payload as TelegramNotificationEventPayload;

    if (payload.target.type === 'single') {
      await this.telegramService.sendMessage(payload.target.chatId, payload.message);
      this.logger.log(`Delivered event ${event.id} to chat ${payload.target.chatId}`);
      return;
    }

    const chatIds = await this.telegramService.getBroadcastChatIds();

    if (chatIds.length === 0) {
      this.logger.warn(`Skipping broadcast event ${event.id}: no known broadcast recipients`);
      return;
    }

    for (const chatId of chatIds) {
      await this.telegramService.sendMessage(chatId, payload.message);
    }

    this.logger.log(`Delivered broadcast event ${event.id} to ${chatIds.length} chats`);
  }
}
