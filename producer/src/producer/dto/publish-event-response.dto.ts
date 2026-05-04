import { ApiProperty } from '@nestjs/swagger';

export class PublishEventResponseDto {
  @ApiProperty({
    example: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
  })
  eventId!: string;

  @ApiProperty({
    example: 'published',
  })
  status!: 'published';

  @ApiProperty({
    example: 'telegramify.events',
  })
  exchange!: string;

  @ApiProperty({
    example: 'telegram.notification',
  })
  routingKey!: string;
}
