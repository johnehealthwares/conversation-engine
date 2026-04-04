import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FilterWorkflowInstanceDto {
  @ApiPropertyOptional({ description: 'Search by workflowId, flowId, currentStepId, or status' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flowId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'COMPLETED', 'STOPPED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'COMPLETED', 'STOPPED'])
  status?: 'ACTIVE' | 'COMPLETED' | 'STOPPED';
}
