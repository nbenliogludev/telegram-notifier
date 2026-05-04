import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ProducerModule } from './producer/producer.module';

@Module({
  imports: [ProducerModule],
  controllers: [HealthController],
})
export class AppModule {}
