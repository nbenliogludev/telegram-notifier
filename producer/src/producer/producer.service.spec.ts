import { ProducerService } from './producer.service';
import { RabbitmqPublisherService } from './rabbitmq-publisher.service';

describe('ProducerService', () => {
  const publisher = {
    publish: jest.fn(),
  } as unknown as RabbitmqPublisherService;

  it('returns producer metadata', () => {
    const service = new ProducerService(publisher);

    expect(service.getMetadata()).toEqual({
      name: 'producer',
      status: 'rabbitmq-ready',
      transport: 'rabbitmq',
    });
  });

  it('publishes events with generated event id', async () => {
    jest.spyOn(publisher, 'publish').mockResolvedValue({
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });
    const service = new ProducerService(publisher);

    const response = await service.publishEvent({
      type: 'telegram.notification.requested',
      payload: { message: 'hello' },
    });

    expect(response).toMatchObject({
      status: 'published',
      exchange: 'telegramify.events',
      routingKey: 'telegram.notification',
    });
    expect(response.eventId).toEqual(expect.any(String));
  });
});
