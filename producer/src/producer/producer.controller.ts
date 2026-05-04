import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublishEventDto } from './dto/publish-event.dto';
import { PublishEventResponseDto } from './dto/publish-event-response.dto';
import { PublishTelegramNotificationDto } from './dto/publish-telegram-notification.dto';
import { ProducerService } from './producer.service';

@ApiTags('producer')
@Controller('producer')
export class ProducerController {
  constructor(private readonly producerService: ProducerService) {}

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

  @Post('telegram-notifications')
  @ApiOperation({
    summary: 'Publish a Telegram notification request',
    description:
      'Use targetType=single with chatId for one Telegram chat. Use targetType=broadcast to let a future consumer fan out to all known subscribers.',
  })
  @ApiCreatedResponse({
    description: 'Telegram notification event has been published to RabbitMQ.',
    type: PublishEventResponseDto,
  })
  publishTelegramNotification(
    @Body() dto: PublishTelegramNotificationDto,
  ): Promise<PublishEventResponseDto> {
    return this.producerService.publishTelegramNotification(dto);
  }
}
