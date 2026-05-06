import { NotificationProcessorService } from './notification-processor.service';
import { TelegramService } from './telegram.service';

describe('NotificationProcessorService', () => {
  let sendMessage: jest.Mock;
  let metricsService: {
    observeBroadcastRecipients: jest.Mock;
    recordTelegramNotification: jest.Mock;
  };
  let service: NotificationProcessorService;

  beforeEach(() => {
    sendMessage = jest.fn().mockResolvedValue(undefined);
    metricsService = {
      observeBroadcastRecipients: jest.fn(),
      recordTelegramNotification: jest.fn(),
    };

    const telegramService = {
      sendMessage,
    } as unknown as TelegramService;

    service = new NotificationProcessorService(telegramService, metricsService as never);
  });

  it('sends single-chat Telegram notifications', async () => {
    await service.process({
      id: 'event-1',
      type: 'telegram.notification.requested',
      occurredAt: new Date().toISOString(),
      payload: {
        target: {
          type: 'single',
          chatId: '123456789',
        },
        message: {
          text: 'hello',
          parseMode: 'HTML',
          disableNotification: true,
        },
      },
    });

    expect(sendMessage).toHaveBeenCalledWith('123456789', {
      text: 'hello',
      parseMode: 'HTML',
      disableNotification: true,
    });
    expect(metricsService.recordTelegramNotification).toHaveBeenCalledWith(
      'single',
      'delivered',
      1,
    );
  });

  it('records single-chat delivery errors', async () => {
    const error = new Error('Telegram failed');
    sendMessage.mockRejectedValue(error);

    await expect(
      service.process({
        id: 'event-1',
        type: 'telegram.notification.requested',
        occurredAt: new Date().toISOString(),
        payload: {
          target: {
            type: 'single',
            chatId: '123456789',
          },
          message: {
            text: 'hello',
          },
        },
      }),
    ).rejects.toBe(error);

    expect(metricsService.recordTelegramNotification).toHaveBeenCalledWith(
      'single',
      'error',
      0,
    );
  });

  it('sends broadcast Telegram notifications to configured chat ids', async () => {
    const telegramService = {
      sendMessage,
      getBroadcastChatIds: jest.fn().mockResolvedValue(['1', '2']),
    } as unknown as TelegramService;
    service = new NotificationProcessorService(telegramService, metricsService as never);

    await service.process({
      id: 'event-2',
      type: 'telegram.notification.requested',
      occurredAt: new Date().toISOString(),
      payload: {
        target: {
          type: 'broadcast',
        },
        message: {
          text: 'broadcast',
        },
      },
    });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, '1', {
      text: 'broadcast',
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, '2', {
      text: 'broadcast',
    });
    expect(metricsService.observeBroadcastRecipients).toHaveBeenCalledWith(2);
    expect(metricsService.recordTelegramNotification).toHaveBeenCalledWith(
      'broadcast',
      'delivered',
      2,
    );
  });

  it('skips broadcasts without known recipients', async () => {
    const telegramService = {
      sendMessage,
      getBroadcastChatIds: jest.fn().mockResolvedValue([]),
    } as unknown as TelegramService;
    service = new NotificationProcessorService(telegramService, metricsService as never);

    await service.process({
      id: 'event-4',
      type: 'telegram.notification.requested',
      occurredAt: new Date().toISOString(),
      payload: {
        target: {
          type: 'broadcast',
        },
        message: {
          text: 'broadcast',
        },
      },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(metricsService.observeBroadcastRecipients).toHaveBeenCalledWith(0);
    expect(metricsService.recordTelegramNotification).toHaveBeenCalledWith(
      'broadcast',
      'skipped',
      0,
    );
  });

  it('records partial broadcast delivery errors', async () => {
    const error = new Error('Telegram failed');
    sendMessage.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
    const telegramService = {
      sendMessage,
      getBroadcastChatIds: jest.fn().mockResolvedValue(['1', '2']),
    } as unknown as TelegramService;
    service = new NotificationProcessorService(telegramService, metricsService as never);

    await expect(
      service.process({
        id: 'event-5',
        type: 'telegram.notification.requested',
        occurredAt: new Date().toISOString(),
        payload: {
          target: {
            type: 'broadcast',
          },
          message: {
            text: 'broadcast',
          },
        },
      }),
    ).rejects.toBe(error);

    expect(metricsService.recordTelegramNotification).toHaveBeenCalledWith(
      'broadcast',
      'error',
      1,
    );
  });

  it('skips unsupported event types', async () => {
    await service.process({
      id: 'event-3',
      type: 'unknown.event',
      occurredAt: new Date().toISOString(),
      payload: {},
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(metricsService.recordTelegramNotification).toHaveBeenCalledWith(
      'unsupported',
      'skipped',
      0,
    );
  });
});
