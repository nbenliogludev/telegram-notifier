import { Injectable, Logger } from '@nestjs/common';
import {
  ConsumerEvent,
  TelegramNotificationEventPayload,
} from './interfaces/telegram-notification-event.interface';
import { MetricsService } from '../observability/metrics.service';
import { TelegramService } from './telegram.service';

const TELEGRAM_NOTIFICATION_REQUESTED_EVENT = 'telegram.notification.requested';

@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly metricsService?: MetricsService,
  ) {}

  async process(event: ConsumerEvent): Promise<void> {
    if (event.type !== TELEGRAM_NOTIFICATION_REQUESTED_EVENT) {
      this.logger.warn(`Skipping unsupported event type: ${event.type}`);
      this.metricsService?.recordTelegramNotification('unsupported', 'skipped', 0);
      return;
    }

    const payload = event.payload as TelegramNotificationEventPayload;

    if (payload.target.type === 'single') {
      try {
        await this.telegramService.sendMessage(payload.target.chatId, payload.message);
      } catch (error) {
        this.metricsService?.recordTelegramNotification('single', 'error', 0);
        throw error;
      }

      this.metricsService?.recordTelegramNotification('single', 'delivered', 1);
      this.logger.log(`Delivered event ${event.id} to chat ${payload.target.chatId}`);
      return;
    }

    const chatIds = await this.telegramService.getBroadcastChatIds();
    this.metricsService?.observeBroadcastRecipients(chatIds.length);

    if (chatIds.length === 0) {
      this.logger.warn(`Skipping broadcast event ${event.id}: no known broadcast recipients`);
      this.metricsService?.recordTelegramNotification('broadcast', 'skipped', 0);
      return;
    }

    let deliveredCount = 0;

    for (const chatId of chatIds) {
      try {
        await this.telegramService.sendMessage(chatId, payload.message);
        deliveredCount += 1;
      } catch (error) {
        this.metricsService?.recordTelegramNotification(
          'broadcast',
          'error',
          deliveredCount,
        );
        throw error;
      }
    }

    this.metricsService?.recordTelegramNotification(
      'broadcast',
      'delivered',
      deliveredCount,
    );
    this.logger.log(`Delivered broadcast event ${event.id} to ${chatIds.length} chats`);
  }
}
