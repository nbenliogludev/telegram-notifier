import { MetricsService } from './metrics.service';

describe('producer MetricsService', () => {
  it('records HTTP and RabbitMQ metrics', async () => {
    const service = new MetricsService();

    service.recordHttpRequest('GET', '/health', '200', 0.01);
    service.recordRabbitmqPublish('telegramify.events', 'telegram.notification', 'success', 0.02);
    service.recordRabbitmqPublish('telegramify.events', 'telegram.notification', 'error', 0.03);
    service.recordRabbitmqPublishRetry('telegramify.events', 'telegram.notification', 2);

    const metrics = await service.getMetrics();

    expect(metrics).toContain('telegramify_producer_http_requests_total');
    expect(metrics).toContain('telegramify_producer_rabbitmq_publish_total');
    expect(metrics).toContain('telegramify_producer_rabbitmq_publish_retries_total');
    expect(metrics).toContain('status="success"');
    expect(metrics).toContain('attempt="2"');
  });
});
