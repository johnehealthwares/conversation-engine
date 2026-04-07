// schemas/workflow-instance.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class WorkflowInstance {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId
  @Prop({ required: true })
  workflowId: string;

  @Prop({ required: true, default: 1 })
  workflowVersion: number;

  @Prop({ required: true })
  flowId: string;

  @Prop({ type: Object, default: {} })
  state: Record<string, any>; // stores step responses, flags

  @Prop({ type: Object, default: {} })
  config?: Record<string, any>;

  @Prop({ required: true, default: 'ACTIVE' })
  status: 'ACTIVE' | 'COMPLETED' | 'STOPPED';

  @Prop()
  currentStepId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type WorkflowInstanceDocument = WorkflowInstance & Document;
export const WorkflowInstanceSchema = SchemaFactory.createForClass(WorkflowInstance);
