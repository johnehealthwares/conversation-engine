import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsAtLeastOneProvided } from './send-channel-media.dto';

export class SendChannelMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsAtLeastOneProvided('email') // Validates against email
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsAtLeastOneProvided('email') // Validates against email
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;


  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  previewLink: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class SendMessageByChannelPathDto {

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsAtLeastOneProvided('email') // Validates against email
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsAtLeastOneProvided('email') // Validates against email
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  previewLink: boolean;
}
