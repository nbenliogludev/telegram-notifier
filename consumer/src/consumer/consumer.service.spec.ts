import { ConsumerService } from './consumer.service';
import { TelegramService } from './telegram.service';

describe('ConsumerService', () => {
  it('returns consumer metadata', async () => {
    const telegramService = {
      isConfigured: jest.fn().mockReturnValue(false),
      getConfiguredBroadcastChatIds: jest.fn().mockReturnValue([]),
      getBroadcastChatIds: jest.fn().mockResolvedValue([]),
      getKnownChats: jest.fn().mockResolvedValue([]),
    } as unknown as TelegramService;
    const service = new ConsumerService(telegramService);

    await expect(service.getMetadata()).resolves.toEqual({
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
      getConfiguredBroadcastChatIds: jest.fn().mockReturnValue([]),
      getBroadcastChatIds: jest.fn().mockResolvedValue(['123456789']),
      getKnownChats: jest.fn().mockResolvedValue(chats),
    } as unknown as TelegramService;
    const service = new ConsumerService(telegramService);

    await expect(service.getTelegramChats()).resolves.toEqual(chats);
  });

  it('counts resolved broadcast recipients when Telegram is configured', async () => {
    const telegramService = {
      isConfigured: jest.fn().mockReturnValue(true),
      getConfiguredBroadcastChatIds: jest.fn().mockReturnValue(['1']),
      getBroadcastChatIds: jest.fn().mockResolvedValue(['1', '2']),
      getKnownChats: jest.fn().mockResolvedValue([]),
    } as unknown as TelegramService;
    const service = new ConsumerService(telegramService);

    await expect(service.getMetadata()).resolves.toMatchObject({
      broadcastRecipients: 2,
    });
  });
});
