import { Injectable } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Injectable()
export class ConsumerService {
  private readonly queue = process.env.RABBITMQ_QUEUE ?? 'telegramify.notifications';

  constructor(private readonly telegramService: TelegramService) {}

  getMetadata() {
    return {
      name: 'consumer',
      status: 'listening',
      queue: this.queue,
      telegramConfigured: this.telegramService.isConfigured(),
      broadcastRecipients: this.telegramService.getBroadcastChatIds().length,
    };
  }

  getTelegramChats() {
    return this.telegramService.getKnownChats();
  }
}
