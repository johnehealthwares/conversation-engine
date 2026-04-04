import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ExchangeDirection, ExchangeStatus } from '../../schemas/exchange.schema';

export class FilterExchangeDto {
  @ApiPropertyOptional({ description: 'Search by message id, sender, recipient, message, conversation id, or questionnaire code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channelType?: string;

  @ApiPropertyOptional({ enum: ExchangeDirection })
  @IsOptional()
  @IsEnum(ExchangeDirection)
  direction?: ExchangeDirection;

  @ApiPropertyOptional({ enum: ExchangeStatus })
  @IsOptional()
  @IsEnum(ExchangeStatus)
  status?: ExchangeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionnaireCode?: string;
}
