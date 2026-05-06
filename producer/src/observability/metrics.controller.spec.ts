import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('returns Prometheus metrics', async () => {
    const metricsService = {
      getMetrics: jest.fn().mockResolvedValue('metrics-body'),
    } as unknown as MetricsService;
    const controller = new MetricsController(metricsService);

    await expect(controller.getMetrics()).resolves.toBe('metrics-body');
    expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);
  });
});
