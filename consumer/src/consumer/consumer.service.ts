import { Injectable } from '@nestjs/common';

@Injectable()
export class ConsumerService {
  private readonly queue = process.env.RABBITMQ_QUEUE ?? 'telegramify.notifications';

  getMetadata() {
    return {
      name: 'consumer',
      status: 'initialized',
      queue: this.queue,
    };
  }
}
