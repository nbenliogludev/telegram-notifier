import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        this.recordRequest(request, response.statusCode, startedAt);
      }),
      catchError((error: unknown) => {
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;

        this.recordRequest(request, statusCode, startedAt);

        return throwError(() => error);
      }),
    );
  }

  private recordRequest(
    request: Request,
    statusCode: number,
    startedAt: bigint,
  ): void {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

    this.metricsService.recordHttpRequest(
      request.method,
      this.getRouteLabel(request),
      String(statusCode),
      durationSeconds,
    );
  }

  private getRouteLabel(request: Request): string {
    const routePath = request.route?.path as string | undefined;
    const baseUrl = request.baseUrl ?? '';

    if (routePath && routePath !== '/') {
      return `${baseUrl}${routePath}`;
    }

    if (routePath === '/') {
      return baseUrl || routePath;
    }

    return request.path || 'unknown';
  }
}
