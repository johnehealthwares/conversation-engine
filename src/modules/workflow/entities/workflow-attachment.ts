import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkflowAttachmentStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'ATTACHED'
  | 'INVALID';

export type WorkflowQuestionStepMapping = {
  questionId?: string;
  questionAttribute: string;
  workflowStepId?: string;
};

@Schema({ timestamps: true })
export class WorkflowAttachment {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId
  @Prop({ required: true })
  questionnaireId: string;

  @Prop({ required: true })
  workflowId: string;

  @Prop({ required: true, default: 1 })
  workflowVersion: number;

  @Prop({
    type: [
      {
        questionId: { type: String, required: false },
        questionAttribute: { type: String, required: true },
        workflowStepId: { type: String, required: false },
      },
    ],
    default: [],
  })
  mappings: WorkflowQuestionStepMapping[];

  @Prop({ required: true, default: 'DRAFT' })
  status: WorkflowAttachmentStatus;

  @Prop({ type: Object, default: null })
  validationSummary?: Record<string, any> | null;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export type WorkflowAttachmentDocument = WorkflowAttachment & Document;
export const WorkflowAttachmentSchema =
  SchemaFactory.createForClass(WorkflowAttachment);
