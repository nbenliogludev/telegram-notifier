import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ObservabilityModule } from './observability/observability.module';
import { ProducerModule } from './producer/producer.module';

@Module({
  imports: [ObservabilityModule, ProducerModule],
  controllers: [HealthController],
})
export class AppModule {}
