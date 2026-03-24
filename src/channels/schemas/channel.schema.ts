import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ChannelDocument = Channel;

export enum ChannelType {
  MOCK = 'MOCK',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  WEBCHAT = 'WEBCHAT',
  TELEGRAM = 'TELEGRAM',
  API = 'API',
}

@Schema({ timestamps: true })
export class Channel {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: Object.values(ChannelType) })
  type: ChannelType;

  @Prop()
  provider?: string;

  @Prop()
  externalId?: string;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
