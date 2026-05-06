import { HttpException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('consumer HttpMetricsInterceptor', () => {
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

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') })),
    ).resolves.toBe('ok');
    expect(metricsService.recordHttpRequest).not.toHaveBeenCalled();
  });

  it('records successful HTTP requests with route labels', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = buildHttpContext({
      method: 'GET',
      baseUrl: '/consumer',
      path: '/consumer/telegram-chats',
      route: {
        path: '/telegram-chats',
      },
    });

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/consumer/telegram-chats',
      '200',
      expect.any(Number),
    );
  });

  it('records base route labels', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const context = buildHttpContext({
      method: 'GET',
      baseUrl: '/consumer',
      path: '/consumer',
      route: {
        path: '/',
      },
    });

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/consumer',
      '200',
      expect.any(Number),
    );
  });

  it('records HTTP exception status codes with path fallback', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const error = new HttpException('missing', 404);

    await expect(
      lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'GET',
            path: '/missing',
          }),
          { handle: () => throwError(() => error) },
        ),
      ),
    ).rejects.toBe(error);

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/missing',
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
      '200',
      expect.any(Number),
    );
  });

  it('records unknown errors as 500 with unknown route fallback', async () => {
    const interceptor = new HttpMetricsInterceptor(metricsService);
    const error = new Error('boom');

    await expect(
      lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'GET',
          }),
          { handle: () => throwError(() => error) },
        ),
      ),
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
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;
  }
});
