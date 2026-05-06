import { MetricsService } from './metrics.service';

describe('consumer MetricsService', () => {
  it('records HTTP, RabbitMQ, and Telegram metrics', async () => {
    const service = new MetricsService();

    service.recordHttpRequest('GET', '/consumer', '200', 0.01);
    service.recordRabbitmqMessage('received');
    service.recordRabbitmqMessage('processed', 0.02);
    service.recordRabbitmqMessage('failed', 0.03);
    service.recordRabbitmqMessage('requeued');
    service.recordRabbitmqMessage('rejected');
    service.recordRabbitmqRetry(2);
    service.recordTelegramApiRequest('sendMessage', 'success', 0.04);
    service.recordTelegramApiRequest('sendMessage', 'error', 0.05);
    service.recordTelegramApiRequest('getUpdates', 'missing_token', 0.06);
    service.recordTelegramNotification('single', 'delivered', 1);
    service.recordTelegramNotification('broadcast', 'error', 2);
    service.observeBroadcastRecipients(3);
    service.setKnownChats(4);

    const metrics = await service.getMetrics();

    expect(metrics).toContain('telegramify_consumer_http_requests_total');
    expect(metrics).toContain('telegramify_consumer_rabbitmq_messages_total');
    expect(metrics).toContain('telegramify_consumer_rabbitmq_retries_total');
    expect(metrics).toContain('telegramify_consumer_telegram_api_requests_total');
    expect(metrics).toContain('telegramify_consumer_telegram_notifications_total');
    expect(metrics).toContain('telegramify_consumer_telegram_known_chats 4');
    expect(metrics).toContain('status="missing_token"');
  });
});
