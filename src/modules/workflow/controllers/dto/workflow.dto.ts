import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowEventType } from '../../entities/step-transition';
import { WorkflowStepType } from '../../entities/workflow-step';

export class WorkflowTransitionDto {

  @ApiProperty({ enum: WorkflowEventType })
  @IsIn(Object.values(WorkflowEventType))
  event: WorkflowEventType;

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


  @ApiProperty()
  @IsString()
  startStepId: string;

  @ApiProperty({ enum: WorkflowStepType })
  @IsIn(Object.values(WorkflowStepType))
  type: WorkflowStepType;

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

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTransitionsPerRun?: number;

  @ApiProperty({ default: true })
  @IsBoolean()
  isActive: boolean;
}

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}
