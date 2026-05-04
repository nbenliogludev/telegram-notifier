import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export enum TelegramNotificationTargetType {
  Single = 'single',
  Broadcast = 'broadcast',
}

export enum TelegramParseMode {
  Html = 'HTML',
  Markdown = 'Markdown',
  MarkdownV2 = 'MarkdownV2',
}

export class PublishTelegramNotificationDto {
  @ApiPropertyOptional({
    description: 'Optional idempotency key. A UUID is generated when omitted.',
    example: '2d0b3b7d-42a8-4e0b-9f7d-d9a7d998e7c9',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiProperty({
    description: 'Notification target. Use single for one Telegram chat, broadcast for all known subscribers.',
    enum: TelegramNotificationTargetType,
    example: TelegramNotificationTargetType.Single,
  })
  @IsEnum(TelegramNotificationTargetType)
  targetType!: TelegramNotificationTargetType;

  @ApiPropertyOptional({
    description: 'Telegram chat id. Required when targetType is single.',
    example: '123456789',
  })
  @ValidateIf((dto: PublishTelegramNotificationDto) => dto.targetType === TelegramNotificationTargetType.Single)
  @IsString()
  @IsNotEmpty()
  chatId?: string;

  @ApiProperty({
    description: 'Message text that the Telegram service should send.',
    example: 'Hello from Telegramify',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({
    description: 'Telegram Bot API parse mode.',
    enum: TelegramParseMode,
    example: TelegramParseMode.Html,
  })
  @IsOptional()
  @IsEnum(TelegramParseMode)
  parseMode?: TelegramParseMode;

  @ApiPropertyOptional({
    description: 'Send the Telegram message silently.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  disableNotification?: boolean;

  @ApiPropertyOptional({
    description: 'Optional domain metadata for tracing or future business rules.',
    example: {
      source: 'admin-panel',
      campaignId: 'spring-launch',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
