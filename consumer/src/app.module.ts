import { Module } from '@nestjs/common';
import { ConsumerModule } from './consumer/consumer.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ConsumerModule],
  controllers: [HealthController],
})
export class AppModule {}
