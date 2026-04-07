import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export type ExchangeDocument = Exchange;

export enum ExchangeDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum ExchangeStatus {
  RECEIVED = 'RECEIVED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class Exchange {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  _id: Types.ObjectId
  @Prop()
  channelId?: string;

  @Prop({ required: true })
  channelType: string;

  @Prop({ required: true, enum: Object.values(ExchangeDirection) })
  direction: ExchangeDirection;

  @Prop({ required: true, enum: Object.values(ExchangeStatus) })
  status: ExchangeStatus;

  @Prop()
  recipient?: string;

  @Prop()
  sender?: string;

  @Prop( { required: true })
  messageId: string;

  @Prop( { required: true })
  message: string;

  @Prop()
  conversationId?: string;

  @Prop()
  questionnaireCode?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop({ type: Object, default: {} })
  payload?: Record<string, any>;

  @Prop({ type: Object, default: {} })
  result?: Record<string, any>;

  @Prop({ type: Date })
  sentAt?: string;

  @Prop({ type: Date })
  deliveredAt?: string;

  @Prop({ type: Date })
  readAt?: string;

  @Prop({ type: Date })
  failedAt?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ExchangeSchema = SchemaFactory.createForClass(Exchange);
