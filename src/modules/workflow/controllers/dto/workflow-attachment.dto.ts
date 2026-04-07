import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowQuestionStepMappingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionAttribute: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowStepId?: string;
}

export class CreateWorkflowAttachmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionnaireId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  workflowId: string;

  @ApiPropertyOptional()
  @IsOptional()
  workflowVersion?: number;

  @ApiProperty({ type: [WorkflowQuestionStepMappingDto], default: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowQuestionStepMappingDto)
  mappings: WorkflowQuestionStepMappingDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateWorkflowAttachmentDto extends PartialType(
  CreateWorkflowAttachmentDto,
) {}

export class ValidateWorkflowAttachmentDto extends CreateWorkflowAttachmentDto {}
