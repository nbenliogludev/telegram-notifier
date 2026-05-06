import { ConsumerController } from './consumer.controller';
import { ConsumerService } from './consumer.service';

describe('ConsumerController', () => {
  const consumerService = {
    getMetadata: jest.fn(),
    getTelegramChats: jest.fn(),
  } as unknown as jest.Mocked<ConsumerService>;
  const controller = new ConsumerController(consumerService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns consumer metadata', async () => {
    const metadata = {
      name: 'consumer',
      status: 'listening',
      queue: 'telegramify.notifications',
      telegramConfigured: true,
      broadcastRecipients: 1,
    };

    consumerService.getMetadata.mockResolvedValue(metadata);

    await expect(controller.getMetadata()).resolves.toBe(metadata);
  });

  it('returns Telegram chats', async () => {
    const chats = [
      {
        id: '123456789',
        type: 'private',
        displayName: 'Nikolay',
      },
    ];

    consumerService.getTelegramChats.mockResolvedValue(chats);

    await expect(controller.getTelegramChats()).resolves.toBe(chats);
  });
});
