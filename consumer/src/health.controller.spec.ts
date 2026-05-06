import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns consumer health', () => {
    expect(new HealthController().check()).toEqual({
      status: 'ok',
      service: 'consumer',
    });
  });
});
