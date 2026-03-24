// dto/create-question.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType, RenderMode, ProcessMode } from '../../../../shared/domain';
import type { AIQuestionConfig } from '../../../../shared/domain/ai-question-config';
import type { ValidationRule } from '../../../../shared/domain/validation-rule.domain';

class CreateOptionDto {
  @ApiPropertyOptional({ description: 'Existing Option ID to attach' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsString()
  value: string;

  @ApiProperty()
  @IsInt()
  index: number;
}

export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  questionnaireId: string;

  @ApiPropertyOptional({
    description: 'Machine-friendly attribute key used when responses are aggregated',
  })
  @IsOptional()
  @IsString()
  attribute?: string;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'List of tags associated with the question',
    type: [String], // Important for Swagger to show an array of strings
    example: ['ai', 'urgent', 'feedback'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  questionType: QuestionType;

  @ApiProperty({ enum: RenderMode })
  @IsEnum(RenderMode)
  renderMode: RenderMode;

  @ApiProperty({ enum: ProcessMode })
  @IsEnum(ProcessMode)
  processMode: ProcessMode;

  @ApiProperty()
  @IsInt()
  index: number;

  @ApiProperty({default: false})
  @IsBoolean()
  isRequired: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasLink?: boolean;

  @ApiProperty({default: true})
  @IsBoolean()
  isActive: boolean;

  @ApiProperty()
  @IsString()
  @IsOptional()
  optionListId?: string;

  @ApiPropertyOptional({ type: [CreateOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previousQuestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextQuestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  childQuestionnaireId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  aiConfig?: AIQuestionConfig;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  optionSource?: Record<string, any>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  apiNavigation?: Record<string, any>;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  validationRules?: ValidationRule[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  metadata?: Record<string, any>;
}
