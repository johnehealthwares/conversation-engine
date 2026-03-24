import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowTransitionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nextStepId: string;
}

export class WorkflowStepDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ enum: ['QUESTIONNAIRE', 'ACTION', 'WAIT', 'END'] })
  @IsIn(['QUESTIONNAIRE', 'ACTION', 'WAIT', 'END'])
  type: 'QUESTIONNAIRE' | 'ACTION' | 'WAIT' | 'END';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiProperty({ type: [WorkflowTransitionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions: WorkflowTransitionDto[];
}

export class CreateWorkflowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ type: [WorkflowStepDto], default: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[];

  @ApiProperty({ default: true })
  @IsBoolean()
  isActive: boolean;
}

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}

