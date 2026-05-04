import { ConsumerService } from './consumer.service';

describe('ConsumerService', () => {
  it('returns consumer metadata', () => {
    const service = new ConsumerService();

    expect(service.getMetadata()).toEqual({
      name: 'consumer',
      status: 'initialized',
      queue: 'telegramify.notifications',
    });
  });
});
