import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  const originalFetch = global.fetch;
  let metricsService: {
    recordTelegramApiRequest: jest.Mock;
    setKnownChats: jest.Mock;
  };

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_BROADCAST_CHAT_IDS = '1, 2,,3';
    metricsService = {
      recordTelegramApiRequest: jest.fn(),
      setKnownChats: jest.fn(),
    };
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
    const service = new TelegramService(metricsService as never);

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
    expect(metricsService.recordTelegramApiRequest).toHaveBeenCalledWith(
      'sendMessage',
      'success',
      expect.any(Number),
    );
  });

  it('returns configured broadcast chat ids from env', () => {
    const service = new TelegramService();

    expect(service.getConfiguredBroadcastChatIds()).toEqual(['1', '2', '3']);
    expect(service.isConfigured()).toBe(true);
  });

  it('returns no configured broadcast chat ids when env is omitted', () => {
    delete process.env.TELEGRAM_BROADCAST_CHAT_IDS;
    const service = new TelegramService();

    expect(service.getConfiguredBroadcastChatIds()).toEqual([]);
  });

  it('returns broadcast chat ids from configured and known chats', async () => {
    process.env.TELEGRAM_BROADCAST_CHAT_IDS = '1, 2';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ok: true,
        result: [
          {
            message: {
              chat: {
                id: 2,
                type: 'private',
                first_name: 'Configured',
              },
            },
          },
          {
            message: {
              chat: {
                id: 3,
                type: 'private',
                first_name: 'Known',
              },
            },
          },
        ],
      }),
    });
    const service = new TelegramService(metricsService as never);

    await expect(service.getBroadcastChatIds()).resolves.toEqual(['1', '2', '3']);
    expect(metricsService.setKnownChats).toHaveBeenCalledWith(2);
  });

  it('returns known chats from Telegram updates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ok: true,
        result: [
          {
            edited_message: {
              chat: {
                id: 123456789,
                type: 'private',
                first_name: 'Nikolay',
                last_name: 'Test',
              },
            },
            channel_post: {
              chat: {
                id: -1001,
                type: 'group',
                title: 'Telegramify QA',
              },
            },
            edited_channel_post: {
              chat: {
                id: -1002,
                type: 'channel',
                username: 'telegramify_channel',
              },
            },
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
            my_chat_member: {
              chat: {
                id: -1003,
                type: 'supergroup',
              },
            },
            chat_member: {
              chat: {
                id: -1004,
                type: 'group',
                first_name: 'Member',
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
    const service = new TelegramService(metricsService as never);

    await expect(service.getKnownChats()).resolves.toEqual([
      {
        id: '-1002',
        type: 'channel',
        displayName: '@telegramify_channel',
        username: 'telegramify_channel',
        firstName: undefined,
        lastName: undefined,
        title: undefined,
        phoneNumber: undefined,
      },
      {
        id: '-1003',
        type: 'supergroup',
        displayName: 'Chat -1003',
        username: undefined,
        firstName: undefined,
        lastName: undefined,
        title: undefined,
        phoneNumber: undefined,
      },
      {
        id: '-1004',
        type: 'group',
        displayName: 'Member',
        username: undefined,
        firstName: 'Member',
        lastName: undefined,
        title: undefined,
        phoneNumber: undefined,
      },
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
        phoneNumber: undefined,
      },
    ]);
    expect(metricsService.setKnownChats).toHaveBeenCalledWith(5);
  });

  it('returns no known chats when Telegram has no updates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ok: true,
      }),
    });
    const service = new TelegramService(metricsService as never);

    await expect(service.getKnownChats()).resolves.toEqual([]);
    expect(metricsService.setKnownChats).toHaveBeenCalledWith(0);
  });

  it('throws and records missing token errors', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const service = new TelegramService(metricsService as never);

    await expect(service.sendMessage('123', { text: 'hello' })).rejects.toThrow(
      'TELEGRAM_BOT_TOKEN is not configured',
    );
    expect(metricsService.recordTelegramApiRequest).toHaveBeenCalledWith(
      'sendMessage',
      'missing_token',
      expect.any(Number),
    );
  });

  it('throws Telegram API descriptions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        ok: false,
        description: 'Bad request',
      }),
    });
    const service = new TelegramService(metricsService as never);

    await expect(service.sendMessage('123', { text: 'hello' })).rejects.toThrow(
      'Bad request',
    );
    expect(metricsService.recordTelegramApiRequest).toHaveBeenCalledWith(
      'sendMessage',
      'error',
      expect.any(Number),
    );
  });

  it('throws Telegram API status fallback errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 502,
      json: jest.fn().mockResolvedValue({
        ok: false,
      }),
    });
    const service = new TelegramService(metricsService as never);

    await expect(service.sendMessage('123', { text: 'hello' })).rejects.toThrow(
      'Telegram API failed with status 502',
    );
  });

  it('ignores contact phone numbers from other users', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ok: true,
        result: [
          {
            message: {
              chat: {
                id: 123,
                type: 'private',
                first_name: 'Nikolay',
              },
              contact: {
                user_id: 456,
                phone_number: '+10000000000',
              },
            },
          },
          {
            message: {
              chat: {
                id: 789,
                type: 'private',
                first_name: 'No Contact',
              },
            },
          },
          {
            message: {},
          },
        ],
      }),
    });
    const service = new TelegramService(metricsService as never);

    await expect(service.getKnownChats()).resolves.toEqual([
      {
        id: '123',
        type: 'private',
        displayName: 'Nikolay',
        username: undefined,
        firstName: 'Nikolay',
        lastName: undefined,
        title: undefined,
        phoneNumber: undefined,
      },
      {
        id: '789',
        type: 'private',
        displayName: 'No Contact',
        username: undefined,
        firstName: 'No Contact',
        lastName: undefined,
        title: undefined,
        phoneNumber: undefined,
      },
    ]);
  });
});
