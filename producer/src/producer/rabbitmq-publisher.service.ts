import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, ChannelModel, ConfirmChannel, Options } from 'amqplib';
import { MetricsService } from '../observability/metrics.service';
import { ProducerEvent } from './interfaces/producer-event.interface';

export interface RabbitmqPublishResult {
  exchange: string;
  routingKey: string;
}

@Injectable()
export class RabbitmqPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqPublisherService.name);
  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
  private readonly exchange = process.env.RABBITMQ_EXCHANGE ?? 'telegramify.events';
  private readonly queue = process.env.RABBITMQ_QUEUE ?? 'telegramify.notifications';
  private readonly routingKey = process.env.RABBITMQ_ROUTING_KEY ?? 'telegram.notification';
  private readonly retryAttempts = Number(process.env.RABBITMQ_RETRY_ATTEMPTS ?? 3);
  private readonly retryDelayMs = Number(process.env.RABBITMQ_RETRY_DELAY_MS ?? 500);

  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connectPromise?: Promise<ConfirmChannel>;

  constructor(private readonly metricsService: MetricsService) {}

  async publish(event: ProducerEvent): Promise<RabbitmqPublishResult> {
    const startedAt = process.hrtime.bigint();

    try {
      await this.withRetry(async () => {
        const channel = await this.getChannel();
        const payload = Buffer.from(JSON.stringify(event));
        const publishOptions: Options.Publish = {
          contentType: 'application/json',
          deliveryMode: 2,
          messageId: event.id,
          timestamp: Date.now(),
        };

        channel.publish(this.exchange, this.routingKey, payload, publishOptions);
        await channel.waitForConfirms();
      });
    } catch (error) {
      this.metricsService.recordRabbitmqPublish(
        this.exchange,
        this.routingKey,
        'error',
        this.getDurationSeconds(startedAt),
      );

      throw error;
    }

    this.metricsService.recordRabbitmqPublish(
      this.exchange,
      this.routingKey,
      'success',
      this.getDurationSeconds(startedAt),
    );

    this.logger.log(`Published event ${event.id} to ${this.exchange}:${this.routingKey}`);

    return {
      exchange: this.exchange,
      routingKey: this.routingKey,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeConnection();
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.createChannel();
    }

    return this.connectPromise;
  }

  private async createChannel(): Promise<ConfirmChannel> {
    this.connection = await connect(this.url);
    this.channel = await this.connection.createConfirmChannel();

    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.resetConnection();
    });
    this.connection.on('error', (error: Error) => {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
      this.resetConnection();
    });

    await this.channel.assertExchange(this.exchange, 'direct', { durable: true });
    await this.channel.assertQueue(this.queue, { durable: true });
    await this.channel.bindQueue(this.queue, this.exchange, this.routingKey);

    this.logger.log(`RabbitMQ publisher connected to ${this.exchange}:${this.routingKey}`);

    return this.channel;
  }

  private async withRetry(action: () => Promise<void>): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      try {
        await action();
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `RabbitMQ publish attempt ${attempt}/${this.retryAttempts} failed: ${this.getErrorMessage(error)}`,
        );
        this.metricsService.recordRabbitmqPublishRetry(
          this.exchange,
          this.routingKey,
          attempt,
        );
        await this.closeConnection();

        if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelayMs * attempt);
        }
      }
    }

    throw lastError;
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
    this.connectPromise = undefined;
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
