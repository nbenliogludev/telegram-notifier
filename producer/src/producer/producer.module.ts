import { Module } from '@nestjs/common';
import { ProducerController } from './producer.controller';
import { ProducerService } from './producer.service';
import { RabbitmqPublisherService } from './rabbitmq-publisher.service';

@Module({
  controllers: [ProducerController],
  providers: [ProducerService, RabbitmqPublisherService],
})
export class ProducerModule {}
