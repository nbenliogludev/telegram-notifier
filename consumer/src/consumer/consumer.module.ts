import { Module } from '@nestjs/common';
import { ConsumerController } from './consumer.controller';
import { ConsumerService } from './consumer.service';
import { NotificationProcessorService } from './notification-processor.service';
import { RabbitmqConsumerService } from './rabbitmq-consumer.service';
import { TelegramService } from './telegram.service';

@Module({
  controllers: [ConsumerController],
  providers: [
    ConsumerService,
    NotificationProcessorService,
    RabbitmqConsumerService,
    TelegramService,
  ],
})
export class ConsumerModule {}
