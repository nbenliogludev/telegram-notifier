import { HttpException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('producer HttpMetricsInterceptor', () => {
  const metricsService = {
    recordHttpRequest: jest.fn(),
  } as unknown as jest.Mocked<MetricsService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes through non-HTTP contexts', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;
    const next = {
      handle: jest.fn(() => of('ok')),
    };

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toBe('ok');
    expect(metricsService.recordHttpRequest).not.toHaveBeenCalled();
  });

  it('records successful HTTP requests with controller route labels', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = buildHttpContext({
      method: 'GET',
      baseUrl: '/producer',
      path: '/producer',
      route: {
        path: '/',
      },
    });

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') })),
    ).resolves.toBe('ok');

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/producer',
      '201',
      expect.any(Number),
    );
  });

  it('records successful HTTP requests with nested route labels', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = buildHttpContext({
      method: 'POST',
      baseUrl: '/producer',
      path: '/producer/events',
      route: {
        path: '/events',
      },
    });

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'POST',
      '/producer/events',
      '201',
      expect.any(Number),
    );
  });

  it('records HTTP exception status codes with fallback paths', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = buildHttpContext({
      method: 'GET',
      path: '/unknown',
    });
    const error = new HttpException('missing', 404);

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) })),
    ).rejects.toBe(error);

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/unknown',
      '404',
      expect.any(Number),
    );
  });

  it('records root route labels without a base URL', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = buildHttpContext({
      method: 'GET',
      path: '/',
      route: {
        path: '/',
      },
    });

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/',
      '201',
      expect.any(Number),
    );
  });

  it('records unknown errors as 500 with unknown route fallback', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = buildHttpContext({
      method: 'GET',
    });
    const error = new Error('boom');

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) })),
    ).rejects.toBe(error);

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      'unknown',
      '500',
      expect.any(Number),
    );
  });

  function buildHttpContext(request: Record<string, unknown>): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({
          statusCode: 201,
        }),
      }),
    } as unknown as ExecutionContext;
  }
});
