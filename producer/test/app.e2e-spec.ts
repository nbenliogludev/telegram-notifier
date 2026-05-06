import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RabbitmqPublisherService } from '../src/producer/rabbitmq-publisher.service';

describe('Producer service', () => {
  let app: INestApplication;
  let rabbitmqPublisher: {
    publish: jest.Mock;
  };

  beforeEach(async () => {
    rabbitmqPublisher = {
      publish: jest.fn().mockResolvedValue({
        exchange: 'telegramify.events',
        routingKey: 'telegram.notification',
      }),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RabbitmqPublisherService)
      .useValue(rabbitmqPublisher)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    const httpServer = app.getHttpServer() as Server;

    return request(httpServer).get('/health').expect(200).expect({
      status: 'ok',
      service: 'producer',
    });
  });

  it('/producer (GET)', () => {
    const httpServer = app.getHttpServer() as Server;

    return request(httpServer).get('/producer').expect(200).expect({
      name: 'producer',
      status: 'rabbitmq-ready',
      transport: 'rabbitmq',
    });
  });

  it('/producer/events (POST)', async () => {
    const httpServer = app.getHttpServer() as Server;
    const response = await request(httpServer)
      .post('/producer/events')
      .send({
        eventId: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
        type: 'domain.event',
        payload: {
          ok: true,
        },
      })
      .expect(201);

    expect(response.body).toEqual({
      eventId: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
      status: 'published',
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });
    expect(rabbitmqPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
        type: 'domain.event',
        payload: {
          ok: true,
        },
      }),
    );
  });

  it('/producer/telegram-notifications (POST)', async () => {
    const httpServer = app.getHttpServer() as Server;
    const response = await request(httpServer)
      .post('/producer/telegram-notifications')
      .send({
        eventId: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
        targetType: 'single',
        chatId: '123456789',
        message: 'hello',
        parseMode: 'HTML',
        disableNotification: true,
        metadata: {
          source: 'e2e',
        },
      })
      .expect(201);

    expect(response.body.status).toBe('published');
    expect(rabbitmqPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'telegram.notification.requested',
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
          metadata: {
            source: 'e2e',
          },
        },
      }),
    );
  });

  it('/producer/events (POST) validates input', () => {
    const httpServer = app.getHttpServer() as Server;

    return request(httpServer)
      .post('/producer/events')
      .send({
        type: '',
        payload: 'not-object',
        extra: true,
      })
      .expect(400);
  });

  it('/metrics (GET)', async () => {
    const httpServer = app.getHttpServer() as Server;
    const response = await request(httpServer).get('/metrics').expect(200);

    expect(response.text).toContain('telegramify_producer_http_requests_total');
  });
});
