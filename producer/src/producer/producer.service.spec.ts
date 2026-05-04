import { ProducerService } from './producer.service';

describe('ProducerService', () => {
  it('returns producer metadata', () => {
    const service = new ProducerService();

    expect(service.getMetadata()).toEqual({
      name: 'producer',
      status: 'initialized',
    });
  });
});
