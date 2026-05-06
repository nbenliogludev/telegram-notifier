import 'reflect-metadata';
import { validate } from 'class-validator';
import { PublishEventResponseDto } from './publish-event-response.dto';
import { PublishEventDto } from './publish-event.dto';
import {
  PublishTelegramNotificationDto,
  TelegramNotificationTargetType,
  TelegramParseMode,
} from './publish-telegram-notification.dto';

describe('producer DTOs', () => {
  it('validates generic event payloads', async () => {
    const validDto = Object.assign(new PublishEventDto(), {
      eventId: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
      type: 'domain.event',
      payload: {
        hello: 'world',
      },
    });
    const invalidDto = Object.assign(new PublishEventDto(), {
      eventId: 'not-a-uuid',
      type: '',
      payload: 'not-object',
    });

    await expect(validate(validDto)).resolves.toEqual([]);
    await expect(validate(invalidDto)).resolves.toHaveLength(3);
  });

  it('validates single Telegram notification payloads', async () => {
    const validDto = Object.assign(new PublishTelegramNotificationDto(), {
      eventId: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
      targetType: TelegramNotificationTargetType.Single,
      chatId: '123456789',
      message: 'hello',
      parseMode: TelegramParseMode.Html,
      disableNotification: false,
      metadata: {
        source: 'spec',
      },
    });
    const invalidDto = Object.assign(new PublishTelegramNotificationDto(), {
      targetType: TelegramNotificationTargetType.Single,
      message: '',
      parseMode: 'invalid',
      disableNotification: 'no',
      metadata: 'no',
    });

    await expect(validate(validDto)).resolves.toEqual([]);
    await expect(validate(invalidDto)).resolves.toHaveLength(5);
  });

  it('does not require chat id for broadcast payloads', async () => {
    const dto = Object.assign(new PublishTelegramNotificationDto(), {
      targetType: TelegramNotificationTargetType.Broadcast,
      message: 'hello',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('represents publish responses', () => {
    const dto = Object.assign(new PublishEventResponseDto(), {
      eventId: 'event-1',
      status: 'published' as const,
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });

    expect(dto).toEqual({
      eventId: 'event-1',
      status: 'published',
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });
  });
});
