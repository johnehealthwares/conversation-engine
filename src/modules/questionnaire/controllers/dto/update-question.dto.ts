import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  IsMongoId,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  QuestionType,
  RenderMode,
  ProcessMode,
} from '../../../../shared/domain';

import { CreateOptionDto } from './create-option.dto';
import type { AIQuestionConfig } from '../../../../shared/domain/ai-question-config';
import type { ValidationRule } from '../../../../shared/domain/validation-rule.domain';

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({
    description: 'List of tags associated with the question',
    type: [String], // Important for Swagger to show an array of strings
    example: ['ai', 'urgent', 'feedback'],
    required: false,
    default: [] 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attribute?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @ApiPropertyOptional({ enum: RenderMode })
  @IsOptional()
  @IsEnum(RenderMode)
  renderMode?: RenderMode;

  @ApiPropertyOptional({ enum: ProcessMode })
  @IsOptional()
  @IsEnum(ProcessMode)
  processMode?: ProcessMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  index?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasLink?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  nextQuestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  validationRules?: ValidationRule[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  aiConfig?: AIQuestionConfig;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  optionSource?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  apiNavigation?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // 🔹 Either inline options
  @ApiPropertyOptional({ type: [CreateOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];

  // 🔹 Or reference an existing option list
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  optionListId?: string;


    @ApiProperty({
      description: 'Optional ID of a child questionnaire triggered by this option',
      required: false,
    })
    @IsOptional()
    @IsMongoId()
    questionnaireId?: string;
}
