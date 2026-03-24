import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MockInboundDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  from: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionnaireCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageId?: string;
}
