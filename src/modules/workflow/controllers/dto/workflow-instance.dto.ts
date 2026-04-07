import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateWorkflowInstanceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  workflowId: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  workflowVersion?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  flowId: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  state?: Record<string, any>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'STOPPED'], default: 'ACTIVE' })
  @IsIn(['ACTIVE', 'COMPLETED', 'STOPPED'])
  status: 'ACTIVE' | 'COMPLETED' | 'STOPPED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentStepId?: string;
}

export class UpdateWorkflowInstanceDto extends PartialType(CreateWorkflowInstanceDto) {}
