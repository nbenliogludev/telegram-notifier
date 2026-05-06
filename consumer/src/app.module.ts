import { Module } from '@nestjs/common';
import { ConsumerModule } from './consumer/consumer.module';
import { HealthController } from './health.controller';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [ObservabilityModule, ConsumerModule],
  controllers: [HealthController],
})
export class AppModule {}
