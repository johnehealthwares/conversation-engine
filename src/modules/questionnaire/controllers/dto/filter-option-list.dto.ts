import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FilterOptionListDto {
  @ApiPropertyOptional({ description: 'Search by option list name, tags, or option label/value/key' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}
