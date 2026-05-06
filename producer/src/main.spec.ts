const mockApp = {
  get: jest.fn((token: unknown) => token),
  listen: jest.fn().mockResolvedValue(undefined),
  useGlobalInterceptors: jest.fn(),
  useGlobalPipes: jest.fn(),
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
  ApiCreatedResponse: () => () => undefined,
  ApiExcludeController: () => () => undefined,
  ApiOkResponse: () => () => undefined,
  ApiOperation: () => () => undefined,
  ApiProperty: () => () => undefined,
  ApiPropertyOptional: () => () => undefined,
  ApiTags: () => () => undefined,
  DocumentBuilder: jest.fn(() => mockDocumentBuilder),
  SwaggerModule: {
    createDocument: jest.fn(() => mockSwaggerDocument),
    setup: jest.fn(),
  },
}));

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { bootstrap } from './main';
import { HttpMetricsInterceptor } from './observability/http-metrics.interceptor';

describe('producer bootstrap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      HOST: '0.0.0.0',
      PORT: '3999',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('configures validation, metrics, Swagger, and listener', async () => {
    await bootstrap();

    expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
    expect(mockApp.useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
    expect(mockApp.get).toHaveBeenCalledWith(HttpMetricsInterceptor);
    expect(mockApp.useGlobalInterceptors).toHaveBeenCalledWith(HttpMetricsInterceptor);
    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(mockApp, mockSwaggerConfig);
    expect(SwaggerModule.setup).toHaveBeenCalledWith('api/docs', mockApp, mockSwaggerDocument);
    expect(mockApp.listen).toHaveBeenCalledWith(3999, '0.0.0.0');
  });

  it('uses default host and port', async () => {
    delete process.env.HOST;
    delete process.env.PORT;

    await bootstrap();

    expect(mockApp.listen).toHaveBeenCalledWith(3000, '127.0.0.1');
  });
});
