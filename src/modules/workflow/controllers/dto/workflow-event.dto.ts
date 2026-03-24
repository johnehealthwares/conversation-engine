import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class EmitWorkflowEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  workflowInstanceId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}

export class MarkWorkflowEventProcessedDto {
  @ApiProperty({ default: true })
  @IsBoolean()
  processed: boolean;
}

