import { NotificationProcessorService } from './notification-processor.service';
import { TelegramService } from './telegram.service';

describe('NotificationProcessorService', () => {
  let sendMessage: jest.Mock;
  let service: NotificationProcessorService;

  beforeEach(() => {
    sendMessage = jest.fn().mockResolvedValue(undefined);

    const telegramService = {
      sendMessage,
    } as unknown as TelegramService;

    service = new NotificationProcessorService(telegramService);
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
  });

  it('sends broadcast Telegram notifications to configured chat ids', async () => {
    const telegramService = {
      sendMessage,
      getBroadcastChatIds: jest.fn().mockResolvedValue(['1', '2']),
    } as unknown as TelegramService;
    service = new NotificationProcessorService(telegramService);

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
  });

  it('skips unsupported event types', async () => {
    await service.process({
      id: 'event-3',
      type: 'unknown.event',
      occurredAt: new Date().toISOString(),
      payload: {},
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
