import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class PublishEventDto {
  @ApiPropertyOptional({
    description: 'Optional idempotency key. A UUID is generated when omitted.',
    example: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiProperty({
    description: 'Domain event type.',
    example: 'telegram.notification.requested',
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    description: 'Event payload serialized to RabbitMQ as JSON.',
    example: {
      chatId: '123456789',
      message: 'Hello from Telegramify Producer',
    },
  })
  @IsObject()
  payload!: Record<string, unknown>;
}
