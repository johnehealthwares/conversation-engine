import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ProcessConversationResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;
}
