// dto/filter-question.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ProcessMode, QuestionType } from '../../../../shared/domain';

export class FilterQuestionDto {
  @ApiPropertyOptional({ description: 'Search by question text, attribute, description, or questionnaire id' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionnaireId?: string;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @ApiPropertyOptional({ enum: ProcessMode })
  @IsOptional()
  @IsEnum(ProcessMode)
  processMode?: ProcessMode;
}
