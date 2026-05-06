jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import { connect } from 'amqplib';
import { MetricsService } from '../observability/metrics.service';
import { NotificationProcessorService } from './notification-processor.service';
import { RabbitmqConsumerService } from './rabbitmq-consumer.service';

const mockedConnect = jest.mocked(connect);

describe('RabbitmqConsumerService', () => {
  const originalEnv = process.env;
  let channel: {
    ack: jest.Mock;
    assertQueue: jest.Mock;
    close: jest.Mock;
    consume: jest.Mock;
    nack: jest.Mock;
    prefetch: jest.Mock;
    sendToQueue: jest.Mock;
  };
  let connection: {
    close: jest.Mock;
    createChannel: jest.Mock;
    on: jest.Mock;
  };
  let connectionHandlers: Record<string, (error?: Error) => void>;
  let metricsService: jest.Mocked<MetricsService>;
  let notificationProcessor: jest.Mocked<NotificationProcessorService>;
  let consumeHandler: (message: unknown) => void;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CONSUMER_AUTO_START: 'true',
      RABBITMQ_PREFETCH: '2',
      RABBITMQ_QUEUE: 'custom.queue',
      RABBITMQ_RETRY_ATTEMPTS: '2',
      RABBITMQ_RETRY_DELAY_MS: '0',
      RABBITMQ_URL: 'amqp://custom',
    };
    channel = {
      ack: jest.fn(),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn((_queue: string, handler: (message: unknown) => void) => {
        consumeHandler = handler;
        return Promise.resolve();
      }),
      nack: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn(),
    };
    connectionHandlers = {};
    connection = {
      close: jest.fn().mockResolvedValue(undefined),
      createChannel: jest.fn().mockResolvedValue(channel),
      on: jest.fn((event: string, handler: (error?: Error) => void) => {
        connectionHandlers[event] = handler;
      }),
    };
    mockedConnect.mockResolvedValue(connection as never);
    metricsService = {
      recordRabbitmqMessage: jest.fn(),
      recordRabbitmqRetry: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;
    notificationProcessor = {
      process: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationProcessorService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  it('does not auto-start when disabled', async () => {
    process.env.CONSUMER_AUTO_START = 'false';
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    await service.onModuleInit();

    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it('starts, consumes valid messages, and handles connection events', async () => {
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    await service.onModuleInit();
    consumeHandler(
      buildMessage({
        id: 'event-1',
        type: 'telegram.notification.requested',
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    );
    await flushPromises();

    expect(mockedConnect).toHaveBeenCalledWith('amqp://custom');
    expect(channel.assertQueue).toHaveBeenCalledWith('custom.queue', { durable: true });
    expect(channel.prefetch).toHaveBeenCalledWith(2);
    expect(channel.consume).toHaveBeenCalledWith('custom.queue', expect.any(Function), {
      noAck: false,
    });
    expect(notificationProcessor.process).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
      }),
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(metricsService.recordRabbitmqMessage).toHaveBeenCalledWith('received');
    expect(metricsService.recordRabbitmqMessage).toHaveBeenCalledWith(
      'processed',
      expect.any(Number),
    );

    connectionHandlers.close();
    connectionHandlers.error(new Error('closed'));
  });

  it('ignores null messages and missing channels', async () => {
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    await service.onModuleInit();
    consumeHandler(null);
    await service.onModuleDestroy();
    consumeHandler(buildMessage({ invalid: true }));
    await flushPromises();

    expect(notificationProcessor.process).not.toHaveBeenCalled();
  });

  it('requeues failed messages with retry metadata', async () => {
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    notificationProcessor.process.mockRejectedValueOnce(new Error('failed'));
    await service.start();
    consumeHandler(
      buildMessage(
        {
          id: 'event-2',
          type: 'telegram.notification.requested',
          occurredAt: new Date().toISOString(),
          payload: {},
        },
        {
          headers: {
            'x-retry-count': '0',
            existing: 'header',
          },
          contentType: undefined,
          messageId: undefined,
          timestamp: undefined,
        },
      ),
    );
    await flushPromises();

    expect(metricsService.recordRabbitmqMessage).toHaveBeenCalledWith(
      'failed',
      expect.any(Number),
    );
    expect(metricsService.recordRabbitmqRetry).toHaveBeenCalledWith(1);
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'custom.queue',
      expect.any(Buffer),
      {
        contentType: 'application/json',
        deliveryMode: 2,
        messageId: undefined,
        timestamp: undefined,
        headers: {
          existing: 'header',
          'x-retry-count': 1,
        },
      },
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(metricsService.recordRabbitmqMessage).toHaveBeenCalledWith('requeued');
  });

  it('rejects failed messages after retry attempts', async () => {
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    notificationProcessor.process.mockRejectedValueOnce('failed');
    await service.start();
    consumeHandler(
      buildMessage(
        {
          id: 'event-3',
          type: 'telegram.notification.requested',
          occurredAt: new Date().toISOString(),
          payload: {},
        },
        {
          headers: {
            'x-retry-count': 2,
          },
        },
      ),
    );
    await flushPromises();

    expect(channel.nack).toHaveBeenCalledWith(expect.any(Object), false, false);
    expect(metricsService.recordRabbitmqMessage).toHaveBeenCalledWith('rejected');
  });

  it('handles invalid payloads and invalid retry headers', async () => {
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    await service.start();
    consumeHandler(
      buildMessage(
        {
          missing: 'required fields',
        },
        {
          headers: {
            'x-retry-count': 'not-a-number',
          },
        },
      ),
    );
    await flushPromises();

    expect(notificationProcessor.process).not.toHaveBeenCalled();
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'custom.queue',
      expect.any(Buffer),
      expect.objectContaining({
        headers: {
          'x-retry-count': 1,
        },
      }),
    );
  });

  it('closes connections on module destroy and swallows close failures', async () => {
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    channel.close.mockRejectedValueOnce(new Error('channel closed'));
    connection.close.mockRejectedValueOnce(new Error('connection closed'));
    await service.start();
    await service.onModuleDestroy();

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('uses default RabbitMQ settings when env vars are omitted', async () => {
    delete process.env.RABBITMQ_PREFETCH;
    delete process.env.RABBITMQ_QUEUE;
    delete process.env.RABBITMQ_RETRY_ATTEMPTS;
    delete process.env.RABBITMQ_RETRY_DELAY_MS;
    delete process.env.RABBITMQ_URL;
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);

    await service.start();

    expect(mockedConnect).toHaveBeenCalledWith('amqp://guest:guest@localhost:5672');
    expect(channel.assertQueue).toHaveBeenCalledWith('telegramify.notifications', {
      durable: true,
    });
    expect(channel.prefetch).toHaveBeenCalledWith(1);
  });

  it('covers invalid private parsing and retry fallbacks', async () => {
    const service = new RabbitmqConsumerService(notificationProcessor, metricsService);
    const privateService = service as unknown as {
      getHeaders: (message: unknown) => Record<string, unknown>;
      getRetryCount: (message: unknown) => number;
      handleProcessingError: (message: unknown, error: unknown) => Promise<void>;
      parseEvent: (raw: string) => unknown;
    };

    await expect(
      privateService.handleProcessingError(buildMessage({ id: 'event-1' }), new Error('no channel')),
    ).resolves.toBeUndefined();
    expect(() => privateService.parseEvent('null')).toThrow('Invalid event payload');
    expect(() => privateService.parseEvent('"not-object"')).toThrow('Invalid event payload');
    expect(
      privateService.getRetryCount(
        buildMessage(
          {},
          {
            headers: {},
          },
        ),
      ),
    ).toBe(0);
    expect(
      privateService.getHeaders(
        buildMessage(
          {},
          {
            headers: 'not-object' as never,
          },
        ),
      ),
    ).toEqual({});
  });

  function buildMessage(
    body: unknown,
    overrides: {
      contentType?: unknown;
      headers?: Record<string, unknown>;
      messageId?: unknown;
      timestamp?: unknown;
    } = {},
  ) {
    return {
      content: Buffer.from(JSON.stringify(body)),
      properties: {
        contentType: hasOverride(overrides, 'contentType')
          ? overrides.contentType
          : 'application/json',
        headers: hasOverride(overrides, 'headers') ? overrides.headers : {},
        messageId: hasOverride(overrides, 'messageId') ? overrides.messageId : 'message-1',
        timestamp: hasOverride(overrides, 'timestamp') ? overrides.timestamp : 123,
      },
    };
  }

  function hasOverride(
    overrides: Record<string, unknown>,
    key: string,
  ): boolean {
    return Object.prototype.hasOwnProperty.call(overrides, key);
  }

  function flushPromises() {
    return new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }
});
