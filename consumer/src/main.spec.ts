const mockApp = {
  get: jest.fn((token: unknown) => token),
  listen: jest.fn().mockResolvedValue(undefined),
  useGlobalInterceptors: jest.fn(),
};

const mockSwaggerConfig = { openapi: '3.0.0' };
const mockSwaggerDocument = { paths: {} };
const mockDocumentBuilder = {
  setDescription: jest.fn(() => mockDocumentBuilder),
  setTitle: jest.fn(() => mockDocumentBuilder),
  setVersion: jest.fn(() => mockDocumentBuilder),
  build: jest.fn(() => mockSwaggerConfig),
};

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(() => Promise.resolve(mockApp)),
  },
}));

jest.mock('@nestjs/swagger', () => ({
  ApiExcludeController: () => () => undefined,
  ApiOkResponse: () => () => undefined,
  ApiTags: () => () => undefined,
  DocumentBuilder: jest.fn(() => mockDocumentBuilder),
  SwaggerModule: {
    createDocument: jest.fn(() => mockSwaggerDocument),
    setup: jest.fn(),
  },
}));

import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { bootstrap } from './main';
import { HttpMetricsInterceptor } from './observability/http-metrics.interceptor';

describe('consumer bootstrap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      HOST: '0.0.0.0',
      PORT: '3998',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('configures metrics, Swagger, and listener', async () => {
    await bootstrap();

    expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
    expect(mockApp.get).toHaveBeenCalledWith(HttpMetricsInterceptor);
    expect(mockApp.useGlobalInterceptors).toHaveBeenCalledWith(HttpMetricsInterceptor);
    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(mockApp, mockSwaggerConfig);
    expect(SwaggerModule.setup).toHaveBeenCalledWith('api/docs', mockApp, mockSwaggerDocument);
    expect(mockApp.listen).toHaveBeenCalledWith(3998, '0.0.0.0');
  });

  it('uses default host and port', async () => {
    delete process.env.HOST;
    delete process.env.PORT;

    await bootstrap();

    expect(mockApp.listen).toHaveBeenCalledWith(3002, '127.0.0.1');
  });
});
