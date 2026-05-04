import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PublishEventDto } from './dto/publish-event.dto';
import { PublishEventResponseDto } from './dto/publish-event-response.dto';
import {
  PublishTelegramNotificationDto,
  TelegramNotificationTargetType,
} from './dto/publish-telegram-notification.dto';
import {
  TelegramNotificationEventPayload,
  TelegramNotificationTarget,
} from './interfaces/telegram-notification-event.interface';
import { RabbitmqPublisherService } from './rabbitmq-publisher.service';

const TELEGRAM_NOTIFICATION_REQUESTED_EVENT = 'telegram.notification.requested';

@Injectable()
export class ProducerService {
  constructor(private readonly rabbitmqPublisher: RabbitmqPublisherService) {}

  getMetadata() {
    return {
      name: 'producer',
      status: 'rabbitmq-ready',
      transport: 'rabbitmq',
    };
  }

  async publishEvent(dto: PublishEventDto): Promise<PublishEventResponseDto> {
    const eventId = dto.eventId ?? randomUUID();
    const publishResult = await this.rabbitmqPublisher.publish({
      id: eventId,
      type: dto.type,
      occurredAt: new Date().toISOString(),
      payload: dto.payload,
    });

    return {
      eventId,
      status: 'published',
      exchange: publishResult.exchange,
      routingKey: publishResult.routingKey,
    };
  }

  async publishTelegramNotification(
    dto: PublishTelegramNotificationDto,
  ): Promise<PublishEventResponseDto> {
    return this.publishEvent({
      eventId: dto.eventId,
      type: TELEGRAM_NOTIFICATION_REQUESTED_EVENT,
      payload: this.toTelegramNotificationPayload(dto),
    });
  }

  private toTelegramNotificationPayload(
    dto: PublishTelegramNotificationDto,
  ): TelegramNotificationEventPayload {
    const target: TelegramNotificationTarget =
      dto.targetType === TelegramNotificationTargetType.Single
        ? {
            type: 'single',
            chatId: dto.chatId as string,
          }
        : {
            type: 'broadcast',
          };

    const payload: TelegramNotificationEventPayload = {
      target,
      message: {
        text: dto.message,
      },
    };

    if (dto.parseMode) {
      payload.message.parseMode = dto.parseMode;
    }

    if (dto.disableNotification !== undefined) {
      payload.message.disableNotification = dto.disableNotification;
    }

    if (dto.metadata) {
      payload.metadata = dto.metadata;
    }

    return payload;
  }
}
