import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { ExchangeDirection, ExchangeStatus } from 'src/shared/domain';

@Schema({ timestamps: true })
export class Exchange {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  _id: Types.ObjectId
  @Prop()
  channelId: string;

  @Prop({ required: true })
  channelType: string;

  @Prop({ type: String, required: true, enum: ExchangeDirection })
  direction: ExchangeDirection;

  @Prop({ type: String, required: true, enum: ExchangeStatus })
  status: ExchangeStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  receiverId: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId })
  senderId: Types.ObjectId

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

export type ExchangeDocument = Exchange & Document;

export const ExchangeSchema = SchemaFactory.createForClass(Exchange);
