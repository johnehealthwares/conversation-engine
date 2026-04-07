import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: false })
export class WorkflowHistory {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId
  @Prop({ required: true })
  workflowInstanceId: string;

  @Prop()
  stepId?: string;

  @Prop({ required: true })
  event: string;

  @Prop({ required: true })
  timestamp: Date;
}

export type WorkflowHistoryDocument = WorkflowHistory & Document;
export const WorkflowHistorySchema =
  SchemaFactory.createForClass(WorkflowHistory);
