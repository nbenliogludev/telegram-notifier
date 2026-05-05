import { Injectable } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Injectable()
export class ConsumerService {
  private readonly queue = process.env.RABBITMQ_QUEUE ?? 'telegramify.notifications';

  constructor(private readonly telegramService: TelegramService) {}

  async getMetadata() {
    const telegramConfigured = this.telegramService.isConfigured();

    return {
      name: 'consumer',
      status: 'listening',
      queue: this.queue,
      telegramConfigured,
      broadcastRecipients: await this.getBroadcastRecipientsCount(telegramConfigured),
    };
  }

  getTelegramChats() {
    return this.telegramService.getKnownChats();
  }

  private async getBroadcastRecipientsCount(telegramConfigured: boolean): Promise<number> {
    const configuredChatIds = this.telegramService.getConfiguredBroadcastChatIds();

    if (!telegramConfigured) {
      return configuredChatIds.length;
    }

    try {
      return (await this.telegramService.getBroadcastChatIds()).length;
    } catch {
      return configuredChatIds.length;
    }
  }
}
