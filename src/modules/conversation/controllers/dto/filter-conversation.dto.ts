import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ConversationStatus } from '../../../../shared/domain';

export class FilterConversationDto {
  @ApiPropertyOptional({ description: 'Search by participant, questionnaire, channel, or ids' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionnaireId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  participantId?: string;

  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;
}
