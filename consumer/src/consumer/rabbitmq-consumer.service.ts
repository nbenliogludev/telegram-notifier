import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Channel, ChannelModel, connect, ConsumeMessage, Options } from 'amqplib';
import { MetricsService } from '../observability/metrics.service';
import { ConsumerEvent } from './interfaces/telegram-notification-event.interface';
import { NotificationProcessorService } from './notification-processor.service';

@Injectable()
export class RabbitmqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqConsumerService.name);
  private readonly autoStart = process.env.CONSUMER_AUTO_START !== 'false';
  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
  private readonly queue = process.env.RABBITMQ_QUEUE ?? 'telegramify.notifications';
  private readonly prefetch = Number(process.env.RABBITMQ_PREFETCH ?? 1);
  private readonly retryAttempts = Number(process.env.RABBITMQ_RETRY_ATTEMPTS ?? 3);
  private readonly retryDelayMs = Number(process.env.RABBITMQ_RETRY_DELAY_MS ?? 1000);

  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(
    private readonly notificationProcessor: NotificationProcessorService,
    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.autoStart) {
      this.logger.log('RabbitMQ consumer auto start is disabled');
      return;
    }

    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeConnection();
  }

  async start(): Promise<void> {
    this.connection = await connect(this.url);
    this.channel = await this.connection.createChannel();

    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.resetConnection();
    });
    this.connection.on('error', (error: Error) => {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
      this.resetConnection();
    });

    await this.channel.assertQueue(this.queue, { durable: true });
    await this.channel.prefetch(this.prefetch);
    await this.channel.consume(this.queue, (message) => void this.handleMessage(message), {
      noAck: false,
    });

    this.logger.log(`Listening for messages on queue ${this.queue}`);
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    const eventId = this.getMessageId(message);
    const startedAt = process.hrtime.bigint();

    this.metricsService.recordRabbitmqMessage('received');

    try {
      const event = this.parseEvent(message.content.toString('utf8'));

      await this.notificationProcessor.process(event);
      this.channel.ack(message);
      this.metricsService.recordRabbitmqMessage(
        'processed',
        this.getDurationSeconds(startedAt),
      );
      this.logger.log(`Processed message ${eventId}`);
    } catch (error) {
      this.metricsService.recordRabbitmqMessage(
        'failed',
        this.getDurationSeconds(startedAt),
      );
      await this.handleProcessingError(message, error);
    }
  }

  private async handleProcessingError(message: ConsumeMessage, error: unknown): Promise<void> {
    if (!this.channel) {
      return;
    }

    const retryCount = this.getRetryCount(message);
    const nextRetryCount = retryCount + 1;
    const eventId = this.getMessageId(message);

    this.logger.error(
      `Failed to process message ${eventId}: ${this.getErrorMessage(error)}`,
    );

    if (nextRetryCount <= this.retryAttempts) {
      await this.sleep(this.retryDelayMs * nextRetryCount);
      this.metricsService.recordRabbitmqRetry(nextRetryCount);
      this.channel.sendToQueue(
        this.queue,
        message.content,
        this.buildRetryOptions(message, nextRetryCount),
      );
      this.channel.ack(message);
      this.metricsService.recordRabbitmqMessage('requeued');
      this.logger.warn(`Requeued message ${eventId}, retry ${nextRetryCount}/${this.retryAttempts}`);
      return;
    }

    this.channel.nack(message, false, false);
    this.metricsService.recordRabbitmqMessage('rejected');
    this.logger.error(`Rejected message ${eventId} after ${this.retryAttempts} retries`);
  }

  private buildRetryOptions(
    message: ConsumeMessage,
    retryCount: number,
  ): Options.Publish {
    return {
      contentType: this.getStringProperty(message.properties.contentType, 'application/json'),
      deliveryMode: 2,
      messageId: this.getStringProperty(message.properties.messageId),
      timestamp: this.getNumberProperty(message.properties.timestamp),
      headers: {
        ...this.getHeaders(message),
        'x-retry-count': retryCount,
      },
    };
  }

  private parseEvent(raw: string): ConsumerEvent {
    const parsed = JSON.parse(raw) as unknown;

    if (!this.isConsumerEvent(parsed)) {
      throw new Error('Invalid event payload');
    }

    return parsed;
  }

  private isConsumerEvent(value: unknown): value is ConsumerEvent {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.type === 'string' &&
      typeof candidate.occurredAt === 'string' &&
      'payload' in candidate
    );
  }

  private getRetryCount(message: ConsumeMessage): number {
    const retryCount = this.getHeaders(message)['x-retry-count'];

    if (typeof retryCount === 'number') {
      return retryCount;
    }

    if (typeof retryCount === 'string') {
      const parsedRetryCount = Number(retryCount);

      return Number.isFinite(parsedRetryCount) ? parsedRetryCount : 0;
    }

    return 0;
  }

  private getMessageId(message: ConsumeMessage): string {
    return this.getStringProperty(message.properties.messageId, 'unknown') ?? 'unknown';
  }

  private getHeaders(message: ConsumeMessage): Record<string, unknown> {
    const headers = message.properties.headers as unknown;

    if (!headers || typeof headers !== 'object') {
      return {};
    }

    return headers as Record<string, unknown>;
  }

  private getStringProperty(value: unknown, fallback?: string): string | undefined {
    return typeof value === 'string' ? value : fallback;
  }

  private getNumberProperty(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }

  private async closeConnection(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;

    this.resetConnection();

    await channel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  }

  private resetConnection(): void {
    this.channel = undefined;
    this.connection = undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private getDurationSeconds(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  }
}
