jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import { connect } from 'amqplib';
import { MetricsService } from '../observability/metrics.service';
import { RabbitmqPublisherService } from './rabbitmq-publisher.service';

const mockedConnect = jest.mocked(connect);

describe('RabbitmqPublisherService', () => {
  const originalEnv = process.env;
  let channel: {
    assertExchange: jest.Mock;
    assertQueue: jest.Mock;
    bindQueue: jest.Mock;
    close: jest.Mock;
    publish: jest.Mock;
    waitForConfirms: jest.Mock;
  };
  let connection: {
    close: jest.Mock;
    createConfirmChannel: jest.Mock;
    on: jest.Mock;
  };
  let connectionHandlers: Record<string, (error?: Error) => void>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RABBITMQ_EXCHANGE: 'custom.exchange',
      RABBITMQ_QUEUE: 'custom.queue',
      RABBITMQ_ROUTING_KEY: 'custom.routing',
      RABBITMQ_RETRY_ATTEMPTS: '2',
      RABBITMQ_RETRY_DELAY_MS: '0',
      RABBITMQ_URL: 'amqp://custom',
    };
    channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn(),
      waitForConfirms: jest.fn().mockResolvedValue(undefined),
    };
    connectionHandlers = {};
    connection = {
      close: jest.fn().mockResolvedValue(undefined),
      createConfirmChannel: jest.fn().mockResolvedValue(channel),
      on: jest.fn((event: string, handler: (error?: Error) => void) => {
        connectionHandlers[event] = handler;
      }),
    };
    mockedConnect.mockResolvedValue(connection as never);
    metricsService = {
      recordRabbitmqPublish: jest.fn(),
      recordRabbitmqPublishRetry: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  it('connects, publishes, records success, and reuses the channel', async () => {
    const service = new RabbitmqPublisherService(metricsService);
    const event = {
      id: 'event-1',
      type: 'domain.event',
      occurredAt: new Date().toISOString(),
      payload: {
        ok: true,
      },
    };

    await expect(service.publish(event)).resolves.toEqual({
      exchange: 'custom.exchange',
      routingKey: 'custom.routing',
    });
    await service.publish({ ...event, id: 'event-2' });

    expect(mockedConnect).toHaveBeenCalledTimes(1);
    expect(mockedConnect).toHaveBeenCalledWith('amqp://custom');
    expect(channel.assertExchange).toHaveBeenCalledWith('custom.exchange', 'direct', {
      durable: true,
    });
    expect(channel.assertQueue).toHaveBeenCalledWith('custom.queue', { durable: true });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'custom.queue',
      'custom.exchange',
      'custom.routing',
    );
    expect(channel.publish).toHaveBeenCalledWith(
      'custom.exchange',
      'custom.routing',
      Buffer.from(JSON.stringify(event)),
      expect.objectContaining({
        contentType: 'application/json',
        deliveryMode: 2,
        messageId: 'event-1',
      }),
    );
    expect(metricsService.recordRabbitmqPublish).toHaveBeenCalledWith(
      'custom.exchange',
      'custom.routing',
      'success',
      expect.any(Number),
    );

    connectionHandlers.close();
    connectionHandlers.error(new Error('closed'));
  });

  it('retries failed publishes and closes the stale connection', async () => {
    channel.waitForConfirms
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce(undefined);
    channel.close.mockRejectedValueOnce(new Error('already closed'));
    connection.close.mockRejectedValueOnce(new Error('already closed'));
    const service = new RabbitmqPublisherService(metricsService);

    await expect(
      service.publish({
        id: 'event-1',
        type: 'domain.event',
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    ).resolves.toEqual({
      exchange: 'custom.exchange',
      routingKey: 'custom.routing',
    });

    expect(metricsService.recordRabbitmqPublishRetry).toHaveBeenCalledWith(
      'custom.exchange',
      'custom.routing',
      1,
    );
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(metricsService.recordRabbitmqPublish).toHaveBeenLastCalledWith(
      'custom.exchange',
      'custom.routing',
      'success',
      expect.any(Number),
    );
  });

  it('records final publish errors after all retries', async () => {
    channel.waitForConfirms.mockRejectedValue('string failure');
    const service = new RabbitmqPublisherService(metricsService);

    await expect(
      service.publish({
        id: 'event-1',
        type: 'domain.event',
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    ).rejects.toBe('string failure');

    expect(metricsService.recordRabbitmqPublishRetry).toHaveBeenCalledTimes(2);
    expect(metricsService.recordRabbitmqPublish).toHaveBeenCalledWith(
      'custom.exchange',
      'custom.routing',
      'error',
      expect.any(Number),
    );
  });

  it('closes connections on module destroy', async () => {
    const service = new RabbitmqPublisherService(metricsService);

    await service.publish({
      id: 'event-1',
      type: 'domain.event',
      occurredAt: new Date().toISOString(),
      payload: {},
    });
    await service.onModuleDestroy();

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('uses default RabbitMQ settings when env vars are omitted', async () => {
    delete process.env.RABBITMQ_EXCHANGE;
    delete process.env.RABBITMQ_QUEUE;
    delete process.env.RABBITMQ_RETRY_ATTEMPTS;
    delete process.env.RABBITMQ_RETRY_DELAY_MS;
    delete process.env.RABBITMQ_ROUTING_KEY;
    delete process.env.RABBITMQ_URL;
    const service = new RabbitmqPublisherService(metricsService);

    await expect(
      service.publish({
        id: 'event-1',
        type: 'domain.event',
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    ).resolves.toEqual({
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });

    expect(mockedConnect).toHaveBeenCalledWith('amqp://guest:guest@localhost:5672');
    expect(channel.assertQueue).toHaveBeenCalledWith('telegramify.notifications', {
      durable: true,
    });
  });
});
