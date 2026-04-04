import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ConversationState, ConversationStatus } from '../../../../shared/domain';

export class CreateConversationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  questionnaireId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  questionnaireCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  channelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  participantId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateConversationDto) => !dto.participantId)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  currentQuestionId?: string;

  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiPropertyOptional({ enum: ConversationState })
  @IsOptional()
  @IsEnum(ConversationState)
  state?: ConversationState;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

export class UpdateConversationDto extends PartialType(CreateConversationDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  workflowInstanceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  endedAt?: Date | string;
}
