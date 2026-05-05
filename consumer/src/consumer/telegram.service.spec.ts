import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_BROADCAST_CHAT_IDS = '1, 2,,3';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ ok: true }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BROADCAST_CHAT_IDS;
  });

  it('sends Telegram messages through Bot API', async () => {
    const service = new TelegramService();

    await service.sendMessage('123456789', {
      text: 'hello',
      parseMode: 'HTML',
      disableNotification: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: '123456789',
          text: 'hello',
          parse_mode: 'HTML',
          disable_notification: true,
        }),
      },
    );
  });

  it('returns broadcast chat ids from env', () => {
    const service = new TelegramService();

    expect(service.getBroadcastChatIds()).toEqual(['1', '2', '3']);
  });

  it('returns known chats from Telegram updates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ok: true,
        result: [
          {
            message: {
              chat: {
                id: 123456789,
                type: 'private',
                first_name: 'Nikolay',
                last_name: 'Test',
                username: 'nikolay_test',
              },
              contact: {
                user_id: 123456789,
                phone_number: '+10000000000',
              },
            },
          },
          {
            message: {
              chat: {
                id: -1001,
                type: 'group',
                title: 'Telegramify QA',
              },
            },
          },
        ],
      }),
    });
    const service = new TelegramService();

    await expect(service.getKnownChats()).resolves.toEqual([
      {
        id: '123456789',
        type: 'private',
        displayName: 'Nikolay Test',
        username: 'nikolay_test',
        firstName: 'Nikolay',
        lastName: 'Test',
        title: undefined,
        phoneNumber: '+10000000000',
      },
      {
        id: '-1001',
        type: 'group',
        displayName: 'Telegramify QA',
        username: undefined,
        firstName: undefined,
        lastName: undefined,
        title: 'Telegramify QA',
      },
    ]);
  });
});
