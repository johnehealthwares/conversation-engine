import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { ProcessingStrategy } from '../../../../shared/domain';

export class CreateQuestionnaireDto {
  @ApiProperty({required: true})
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;
  

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  isDynamic: boolean;

  @ApiProperty({ default: 1 })
  @IsNumber()
  version: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startQuestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  allowBackNavigation: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  allowMultipleSessions: boolean;

  @ApiProperty({ enum: ProcessingStrategy })
  @IsEnum(ProcessingStrategy)
  processingStrategy: ProcessingStrategy;

  @ApiProperty({ type: [String], default: [] })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ default: true })
  @IsBoolean()
  isActive: boolean;
}

export class UpdateQuestionnaireDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDynamic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  version?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startQuestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowBackNavigation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowMultipleSessions?: boolean;

  @ApiPropertyOptional({ enum: ProcessingStrategy })
  @IsOptional()
  @IsEnum(ProcessingStrategy)
  processingStrategy?: ProcessingStrategy;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
