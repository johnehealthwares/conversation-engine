import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { MessageContext } from 'src/shared/domain/message-context.domain';

export class ProcessConversationResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sender!: string;

  context: MessageContext;
}
