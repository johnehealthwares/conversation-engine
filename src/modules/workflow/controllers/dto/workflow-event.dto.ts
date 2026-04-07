import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { WorkflowEventType } from '../../entities/step-transition';

export class EmitWorkflowEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  workflowInstanceId: string;


  @ApiProperty({ enum: WorkflowEventType })
  @IsIn(Object.values(WorkflowEventType))
  type: WorkflowEventType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stepId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  stateSchema?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}

export class MarkWorkflowEventProcessedDto {
  @ApiProperty({ default: true })
  @IsBoolean()
  processed: boolean;
}
