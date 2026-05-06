import { PublishEventDto } from './dto/publish-event.dto';
import { PublishTelegramNotificationDto } from './dto/publish-telegram-notification.dto';
import { ProducerController } from './producer.controller';
import { ProducerService } from './producer.service';

describe('ProducerController', () => {
  const producerService = {
    getMetadata: jest.fn(),
    publishEvent: jest.fn(),
    publishTelegramNotification: jest.fn(),
  } as unknown as jest.Mocked<ProducerService>;
  const controller = new ProducerController(producerService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns producer metadata', () => {
    const metadata = {
      name: 'producer',
      status: 'rabbitmq-ready',
      transport: 'rabbitmq',
    };

    producerService.getMetadata.mockReturnValue(metadata);

    expect(controller.getMetadata()).toBe(metadata);
  });

  it('publishes generic events', async () => {
    const dto: PublishEventDto = {
      type: 'domain.event',
      payload: {
        value: true,
      },
    };
    const response = {
      eventId: 'event-1',
      status: 'published' as const,
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    };

    producerService.publishEvent.mockResolvedValue(response);

    await expect(controller.publishEvent(dto)).resolves.toBe(response);
    expect(producerService.publishEvent).toHaveBeenCalledWith(dto);
  });

  it('publishes Telegram notification events', async () => {
    const dto = {
      targetType: 'broadcast',
      message: 'hello',
    } as PublishTelegramNotificationDto;
    const response = {
      eventId: 'event-2',
      status: 'published' as const,
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    };

    producerService.publishTelegramNotification.mockResolvedValue(response);

    await expect(controller.publishTelegramNotification(dto)).resolves.toBe(response);
    expect(producerService.publishTelegramNotification).toHaveBeenCalledWith(dto);
  });
});
