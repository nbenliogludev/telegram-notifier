import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

export type RabbitmqMessageStatus =
  | 'received'
  | 'processed'
  | 'failed'
  | 'requeued'
  | 'rejected';

export type TelegramNotificationTargetType = 'single' | 'broadcast' | 'unsupported';
export type TelegramNotificationStatus = 'delivered' | 'skipped' | 'error';
export type TelegramApiStatus = 'success' | 'error' | 'missing_token';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequestsTotal = new Counter({
    name: 'telegramify_consumer_http_requests_total',
    help: 'Total HTTP requests handled by the consumer service.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  private readonly httpRequestDurationSeconds = new Histogram({
    name: 'telegramify_consumer_http_request_duration_seconds',
    help: 'Consumer HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  private readonly rabbitmqMessagesTotal = new Counter({
    name: 'telegramify_consumer_rabbitmq_messages_total',
    help: 'RabbitMQ consumer message outcomes.',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  private readonly rabbitmqProcessingDurationSeconds = new Histogram({
    name: 'telegramify_consumer_rabbitmq_processing_duration_seconds',
    help: 'RabbitMQ message processing duration in seconds.',
    labelNames: ['status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  private readonly rabbitmqRetriesTotal = new Counter({
    name: 'telegramify_consumer_rabbitmq_retries_total',
    help: 'RabbitMQ message retry attempts.',
    labelNames: ['attempt'] as const,
    registers: [this.registry],
  });

  private readonly telegramApiRequestsTotal = new Counter({
    name: 'telegramify_consumer_telegram_api_requests_total',
    help: 'Telegram Bot API requests grouped by method and status.',
    labelNames: ['method', 'status'] as const,
    registers: [this.registry],
  });

  private readonly telegramApiRequestDurationSeconds = new Histogram({
    name: 'telegramify_consumer_telegram_api_request_duration_seconds',
    help: 'Telegram Bot API request duration in seconds.',
    labelNames: ['method', 'status'] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  private readonly telegramNotificationsTotal = new Counter({
    name: 'telegramify_consumer_telegram_notifications_total',
    help: 'Telegram notification processing outcomes.',
    labelNames: ['target_type', 'status'] as const,
    registers: [this.registry],
  });

  private readonly telegramNotificationRecipientsTotal = new Counter({
    name: 'telegramify_consumer_telegram_notification_recipients_total',
    help: 'Telegram notification recipients attempted by target type and status.',
    labelNames: ['target_type', 'status'] as const,
    registers: [this.registry],
  });

  private readonly broadcastRecipients = new Histogram({
    name: 'telegramify_consumer_broadcast_recipients',
    help: 'Number of recipients resolved for a broadcast notification.',
    buckets: [0, 1, 2, 5, 10, 25, 50, 100],
    registers: [this.registry],
  });

  private readonly knownChats = new Gauge({
    name: 'telegramify_consumer_telegram_known_chats',
    help: 'Last observed number of known Telegram chats from getUpdates.',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      prefix: 'telegramify_consumer_',
      register: this.registry,
    });
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: string,
    durationSeconds: number,
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode,
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  recordRabbitmqMessage(
    status: RabbitmqMessageStatus,
    durationSeconds?: number,
  ): void {
    const labels = { status };

    this.rabbitmqMessagesTotal.inc(labels);

    if (durationSeconds !== undefined) {
      this.rabbitmqProcessingDurationSeconds.observe(labels, durationSeconds);
    }
  }

  recordRabbitmqRetry(attempt: number): void {
    this.rabbitmqRetriesTotal.inc({ attempt: String(attempt) });
  }

  recordTelegramApiRequest(
    method: string,
    status: TelegramApiStatus,
    durationSeconds: number,
  ): void {
    const labels = {
      method,
      status,
    };

    this.telegramApiRequestsTotal.inc(labels);
    this.telegramApiRequestDurationSeconds.observe(labels, durationSeconds);
  }

  recordTelegramNotification(
    targetType: TelegramNotificationTargetType,
    status: TelegramNotificationStatus,
    recipientCount: number,
  ): void {
    const labels = {
      target_type: targetType,
      status,
    };

    this.telegramNotificationsTotal.inc(labels);
    this.telegramNotificationRecipientsTotal.inc(labels, recipientCount);
  }

  observeBroadcastRecipients(recipientCount: number): void {
    this.broadcastRecipients.observe(recipientCount);
  }

  setKnownChats(count: number): void {
    this.knownChats.set(count);
  }
}
