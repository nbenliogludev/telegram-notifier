import { ConsumerService } from './consumer.service';
import { TelegramService } from './telegram.service';

describe('ConsumerService', () => {
  it('returns consumer metadata', () => {
    const telegramService = {
      isConfigured: jest.fn().mockReturnValue(false),
      getBroadcastChatIds: jest.fn().mockReturnValue([]),
      getKnownChats: jest.fn().mockResolvedValue([]),
    } as unknown as TelegramService;
    const service = new ConsumerService(telegramService);

    expect(service.getMetadata()).toEqual({
      name: 'consumer',
      status: 'listening',
      queue: 'telegramify.notifications',
      telegramConfigured: false,
      broadcastRecipients: 0,
    });
  });

  it('returns known Telegram chats', async () => {
    const chats = [
      {
        id: '123456789',
        type: 'private',
        displayName: 'Nikolay',
      },
    ];
    const telegramService = {
      isConfigured: jest.fn().mockReturnValue(true),
      getBroadcastChatIds: jest.fn().mockReturnValue([]),
      getKnownChats: jest.fn().mockResolvedValue(chats),
    } as unknown as TelegramService;
    const service = new ConsumerService(telegramService);

    await expect(service.getTelegramChats()).resolves.toEqual(chats);
  });
});
