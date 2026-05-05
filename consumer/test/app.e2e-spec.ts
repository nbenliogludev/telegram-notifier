import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { HealthController } from '../src/health.controller';

describe('Consumer service', () => {
  let app: INestApplication;
  const previousAutoStart = process.env.CONSUMER_AUTO_START;

  beforeEach(async () => {
    process.env.CONSUMER_AUTO_START = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();

    if (previousAutoStart === undefined) {
      delete process.env.CONSUMER_AUTO_START;
      return;
    }

    process.env.CONSUMER_AUTO_START = previousAutoStart;
  });

  it('/health (GET)', () => {
    expect(app.get(HealthController).check()).toEqual({
      status: 'ok',
      service: 'consumer',
    });
  });
});
