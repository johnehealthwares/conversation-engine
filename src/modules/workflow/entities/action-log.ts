import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: false })
export class ActionLog {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId
  @Prop({ required: true })
  workflowInstanceId: string;

  @Prop({ required: true })
  stepId: string;

  @Prop()
  eventId?: string;

  @Prop()
  correlationId?: string;

  @Prop({ required: true })
  success: boolean;

  @Prop({ required: true, default: 0 })
  durationMs: number;

  @Prop({ type: Object, default: null })
  input?: Record<string, any> | null;

  @Prop({ type: Object, default: null })
  output?: Record<string, any> | null;

  @Prop()
  error?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop({ required: true })
  executedAt: Date;
}

export type ActionLogDocument = ActionLog & Document;
export const ActionLogSchema = SchemaFactory.createForClass(ActionLog);
