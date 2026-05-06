import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns producer health', () => {
    expect(new HealthController().check()).toEqual({
      status: 'ok',
      service: 'producer',
    });
  });
});
