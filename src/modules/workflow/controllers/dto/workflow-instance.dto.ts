import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateWorkflowInstanceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  workflowId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  flowId: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  state?: Record<string, any>;

  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'STOPPED'], default: 'ACTIVE' })
  @IsIn(['ACTIVE', 'COMPLETED', 'STOPPED'])
  status: 'ACTIVE' | 'COMPLETED' | 'STOPPED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentStepId?: string;
}

export class UpdateWorkflowInstanceDto extends PartialType(CreateWorkflowInstanceDto) {}

