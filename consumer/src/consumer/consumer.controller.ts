import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ConsumerService } from './consumer.service';

@ApiTags('consumer')
@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Get()
  @ApiOkResponse({ description: 'Consumer service metadata.' })
  getMetadata() {
    return this.consumerService.getMetadata();
  }
}
