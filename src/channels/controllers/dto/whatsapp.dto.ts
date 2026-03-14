import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum WhatsAppMessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}


export class MediaDto {
  @ApiProperty({ example: '1234567890' })
  id: string;

  @ApiProperty({ example: 'image/jpeg' })
  mime_type: string;

  @ApiProperty({ example: 'abcdef1234567890' })
  sha256: string;

  @ApiProperty({ example: 'image caption', required: false })
  caption?: string;

  @ApiProperty({ example: 'photo.jpg', required: false })
  filename?: string;
}


export class TextDto {
  @ApiProperty({ example: 'Hello from WhatsApp' })
  body: string;
}


export class ButtonReplyDto {
  @IsString()
  id: string;

  @IsString()
  title: string;
}

export class ButtonDto {
  @IsString()
  @IsIn(["reply"])
  type: "reply";

  @ValidateNested()
  @Type(() => ButtonReplyDto)
  reply: ButtonReplyDto;
}

export class InteractiveButtonActionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonDto)
  buttons: ButtonDto[];
}

export class ListRowDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ListSectionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListRowDto)
  rows: ListRowDto[];
}

export class InteractiveListActionDto {
  @IsString()
  button: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListSectionDto)
  sections: ListSectionDto[];
}

export class BodyDto {
  @IsString()
  text: string;
}

export class InteractiveDto {
  @IsString()
  @IsIn(["button", "list"])
  type: "button" | "list";

  @ValidateNested()
  @Type(() => BodyDto)
  body: BodyDto;

  @ValidateNested()
  action: InteractiveButtonActionDto | InteractiveListActionDto;
  
}

export class InteractiveResponse {
  button_reply: {
    id: string,
    title: string
  }
  list_reply: {
    id: string,
    title: string
  }
}

export class InteractiveMessageDto {
  @IsString()
  messaging_product: "whatsapp";

  @IsString()
  to: string;

  @IsString()
  @IsIn(["interactive"])
  type: "interactive";

  @ValidateNested()
  @Type(() => InteractiveDto)
  interactive: InteractiveDto;
}


export class LocationDto {
  @ApiProperty({ example: 6.5244 })
  latitude: number;

  @ApiProperty({ example: 3.3792 })
  longitude: number;

  @ApiProperty({ example: 'Victoria Island', required: false })
  name?: string;

  @ApiProperty({ example: 'Lagos, Nigeria', required: false })
  address?: string;
}

export class MessageDto {
  @ApiProperty({ example: '2348012345678' })
  from: string;

  @ApiProperty({ example: 'wamid.HBgMNT...' })
  id: string;

  @ApiProperty({ example: '1700000000' })
  timestamp: string;

  @ApiProperty({
    example: 'text',
    enum: ['text', 'image', 'document', 'audio', 'video', 'location']
  })
  type: string;

  @ApiProperty({ type: TextDto, required: false })
  text?: TextDto;

  @ApiProperty({ type: InteractiveDto, required: false })
  interactive: InteractiveResponse

  @ApiProperty({ type: MediaDto, required: false })
  image?: MediaDto;

  @ApiProperty({ type: MediaDto, required: false })
  document?: MediaDto;

  @ApiProperty({ type: MediaDto, required: false })
  audio?: MediaDto;

  @ApiProperty({ type: MediaDto, required: false })
  video?: MediaDto;

  @ApiProperty({ type: LocationDto, required: false })
  location?: LocationDto;

  context: {
    from: string,
    id: string
  }
}

export class ContactDto {
  @ApiProperty({
    example: {
      name: 'John Doe'
    }
  })
  profile: {
    name: string;
  };

  @ApiProperty({ example: '2348012345678' })
  wa_id: string;
}


export class MetadataDto {
  @ApiProperty({ example: '1234567890' })
  display_phone_number: string;

  @ApiProperty({ example: '123456789012345' })
  phone_number_id: string;
}


export class StatusDto {
  @ApiProperty({
    example: 'wamid.HBgLMjM0ODE1MDQ4NzgyOBUCABEYEjQ2Q0M4ODVGRkI2RjYyNDc5AA==',
  })
  id: string;

  @ApiProperty({
    enum: WhatsAppMessageStatus,
    example: WhatsAppMessageStatus.DELIVERED,
  })
  status: WhatsAppMessageStatus;

  @ApiProperty({
    example: '1710060212',
    description: 'Unix timestamp from WhatsApp',
  })
  timestamp: string;

  @ApiProperty({
    example: '2348150487828',
  })
  recipient_id: string;
}

export class WebhookValueDto {
  @ApiProperty({ example: 'whatsapp' })
  messaging_product: string;

  @ApiProperty({ type: MetadataDto })
  metadata: MetadataDto;

  @ApiProperty({ type: [ContactDto], required: false })
  contacts?: ContactDto[];

  @ApiProperty({ type: [MessageDto], required: false })
  messages?: MessageDto[];

  @ApiProperty({
    type: [StatusDto],
    required: false,
  })  
  statuses?: StatusDto[];
}

export class ChangeDto {
  @ApiProperty({ example: 'messages' })
  field: string;

  @ApiProperty({ type: WebhookValueDto })
  value: WebhookValueDto;
}


export class EntryDto {
  @ApiProperty({ example: '123456789' })
  id: string;

  @ApiProperty({ type: [ChangeDto] })
  changes: ChangeDto[];
}
export class WhatsAppWebhookDto {
  @ApiProperty({ example: 'whatsapp_business_account' })
  object: string;

  @ApiProperty({ type: [EntryDto] })
  entry: EntryDto[];
}