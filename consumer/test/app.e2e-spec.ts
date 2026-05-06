import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TelegramService } from '../src/consumer/telegram.service';

describe('Consumer service', () => {
  let app: INestApplication;
  const previousAutoStart = process.env.CONSUMER_AUTO_START;
  let telegramService: {
    getBroadcastChatIds: jest.Mock;
    getConfiguredBroadcastChatIds: jest.Mock;
    getKnownChats: jest.Mock;
    isConfigured: jest.Mock;
    sendMessage: jest.Mock;
  };

  beforeEach(async () => {
    process.env.CONSUMER_AUTO_START = 'false';
    telegramService = {
      getBroadcastChatIds: jest.fn().mockResolvedValue(['123456789']),
      getConfiguredBroadcastChatIds: jest.fn().mockReturnValue(['123456789']),
      getKnownChats: jest.fn().mockResolvedValue([
        {
          id: '123456789',
          type: 'private',
          displayName: 'Nikolay',
        },
      ]),
      isConfigured: jest.fn().mockReturnValue(true),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TelegramService)
      .useValue(telegramService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();

    if (previousAutoStart === undefined) {
      delete process.env.CONSUMER_AUTO_START;
      return;
    }

    process.env.CONSUMER_AUTO_START = previousAutoStart;
  });

  it('/health (GET)', () => {
    const httpServer = app.getHttpServer() as Server;

    return request(httpServer).get('/health').expect(200).expect({
      status: 'ok',
      service: 'consumer',
    });
  });

  it('/consumer (GET)', async () => {
    const httpServer = app.getHttpServer() as Server;
    const response = await request(httpServer).get('/consumer').expect(200);

    expect(response.body).toEqual({
      name: 'consumer',
      status: 'listening',
      queue: 'telegramify.notifications',
      telegramConfigured: true,
      broadcastRecipients: 1,
    });
  });

  it('/consumer/telegram-chats (GET)', async () => {
    const httpServer = app.getHttpServer() as Server;
    const response = await request(httpServer).get('/consumer/telegram-chats').expect(200);

    expect(response.body).toEqual([
      {
        id: '123456789',
        type: 'private',
        displayName: 'Nikolay',
      },
    ]);
    expect(telegramService.getKnownChats).toHaveBeenCalledTimes(1);
  });

  it('/metrics (GET)', async () => {
    const httpServer = app.getHttpServer() as Server;
    const response = await request(httpServer).get('/metrics').expect(200);

    expect(response.text).toContain('telegramify_consumer_http_requests_total');
  });
});
