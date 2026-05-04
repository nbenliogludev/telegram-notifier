import {
  TelegramNotificationTargetType,
  TelegramParseMode,
} from './dto/publish-telegram-notification.dto';
import { ProducerService } from './producer.service';
import { RabbitmqPublisherService } from './rabbitmq-publisher.service';

describe('ProducerService', () => {
  let publishMock: jest.Mock;
  let service: ProducerService;

  beforeEach(() => {
    publishMock = jest.fn().mockResolvedValue({
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });

    const publisher = {
      publish: publishMock,
    } as unknown as RabbitmqPublisherService;

    service = new ProducerService(publisher);
  });

  it('returns producer metadata', () => {
    expect(service.getMetadata()).toEqual({
      name: 'producer',
      status: 'rabbitmq-ready',
      transport: 'rabbitmq',
    });
  });

  it('publishes events with generated event id', async () => {
    const response = await service.publishEvent({
      type: 'telegram.notification.requested',
      payload: { message: 'hello' },
    });

    expect(response).toMatchObject({
      status: 'published',
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });
    expect(response.eventId).toEqual(expect.any(String));
  });

  it('publishes single-chat Telegram notification events', async () => {
    const response = await service.publishTelegramNotification({
      targetType: TelegramNotificationTargetType.Single,
      chatId: '123456789',
      message: 'Hello from Telegramify',
      parseMode: TelegramParseMode.Html,
      disableNotification: true,
    });

    expect(response).toMatchObject({
      status: 'published',
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'telegram.notification.requested',
        payload: {
          target: {
            type: 'single',
            chatId: '123456789',
          },
          message: {
            text: 'Hello from Telegramify',
            parseMode: TelegramParseMode.Html,
            disableNotification: true,
          },
        },
      }),
    );
  });

  it('publishes broadcast Telegram notification events', async () => {
    await service.publishTelegramNotification({
      targetType: TelegramNotificationTargetType.Broadcast,
      message: 'Broadcast message',
      metadata: {
        source: 'admin-panel',
      },
    });

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'telegram.notification.requested',
        payload: {
          target: {
            type: 'broadcast',
          },
          message: {
            text: 'Broadcast message',
          },
          metadata: {
            source: 'admin-panel',
          },
        },
      }),
    );
  });
});
