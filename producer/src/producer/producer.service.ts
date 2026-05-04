import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PublishEventDto } from './dto/publish-event.dto';
import { PublishEventResponseDto } from './dto/publish-event-response.dto';
import { RabbitmqPublisherService } from './rabbitmq-publisher.service';

@Injectable()
export class ProducerService {
  constructor(private readonly rabbitmqPublisher: RabbitmqPublisherService) {}

  getMetadata() {
    return {
      name: 'producer',
      status: 'rabbitmq-ready',
      transport: 'rabbitmq',
    };
  }

  async publishEvent(dto: PublishEventDto): Promise<PublishEventResponseDto> {
    const eventId = dto.eventId ?? randomUUID();
    const publishResult = await this.rabbitmqPublisher.publish({
      id: eventId,
      type: dto.type,
      occurredAt: new Date().toISOString(),
      payload: dto.payload,
    });

    return {
      eventId,
      status: 'published',
      exchange: publishResult.exchange,
      routingKey: publishResult.routingKey,
    };
  }
}
