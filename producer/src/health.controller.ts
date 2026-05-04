import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'Producer service is running.' })
  check() {
    return {
      status: 'ok',
      service: 'producer',
    };
  }
}
