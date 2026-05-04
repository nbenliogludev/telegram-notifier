import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PublishEventDto } from './dto/publish-event.dto';
import { PublishEventResponseDto } from './dto/publish-event-response.dto';
import { ProducerService } from './producer.service';

@ApiTags('producer')
@Controller('producer')
export class ProducerController {
  constructor(private readonly producerService: ProducerService) { }

  @Get()
  @ApiOkResponse({ description: 'Producer service metadata.' })
  getMetadata() {
    return this.producerService.getMetadata();
  }

  @Post('events')
  @ApiCreatedResponse({
    description: 'Event has been published to RabbitMQ.',
    type: PublishEventResponseDto,
  })
  publishEvent(@Body() dto: PublishEventDto): Promise<PublishEventResponseDto> {
    return this.producerService.publishEvent(dto);
  }
}
