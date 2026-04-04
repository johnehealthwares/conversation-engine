import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ChannelType } from '../../../shared/domain';

export class FilterChannelDto {
  @ApiPropertyOptional({ description: 'Search by channel name, provider, external id, or type' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ChannelType })
  @IsOptional()
  @IsEnum(ChannelType)
  type?: ChannelType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
