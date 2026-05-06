import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequestsTotal = new Counter({
    name: 'telegramify_producer_http_requests_total',
    help: 'Total HTTP requests handled by the producer service.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  private readonly httpRequestDurationSeconds = new Histogram({
    name: 'telegramify_producer_http_request_duration_seconds',
    help: 'Producer HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  private readonly rabbitmqPublishTotal = new Counter({
    name: 'telegramify_producer_rabbitmq_publish_total',
    help: 'RabbitMQ publish attempts grouped by final status.',
    labelNames: ['exchange', 'routing_key', 'status'] as const,
    registers: [this.registry],
  });

  private readonly rabbitmqPublishDurationSeconds = new Histogram({
    name: 'telegramify_producer_rabbitmq_publish_duration_seconds',
    help: 'RabbitMQ publish duration in seconds.',
    labelNames: ['exchange', 'routing_key', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  private readonly rabbitmqPublishRetriesTotal = new Counter({
    name: 'telegramify_producer_rabbitmq_publish_retries_total',
    help: 'RabbitMQ publish retry attempts.',
    labelNames: ['exchange', 'routing_key', 'attempt'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      prefix: 'telegramify_producer_',
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

  recordRabbitmqPublish(
    exchange: string,
    routingKey: string,
    status: 'success' | 'error',
    durationSeconds: number,
  ): void {
    const labels = {
      exchange,
      routing_key: routingKey,
      status,
    };

    this.rabbitmqPublishTotal.inc(labels);
    this.rabbitmqPublishDurationSeconds.observe(labels, durationSeconds);
  }

  recordRabbitmqPublishRetry(
    exchange: string,
    routingKey: string,
    attempt: number,
  ): void {
    this.rabbitmqPublishRetriesTotal.inc({
      exchange,
      routing_key: routingKey,
      attempt: String(attempt),
    });
  }
}
