import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
}
