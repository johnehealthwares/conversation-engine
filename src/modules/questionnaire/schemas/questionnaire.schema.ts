import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Question, QuestionSchema } from './question.schema';

export enum ProcessingStrategy {
  STATIC = 'STATIC',
  WORKFLOW = 'WORKFLOW',
  AI_ASSISTED = 'AI_ASSISTED',
  FULL_AI = 'FULL_AI',
}

@Schema({ timestamps: true })
export class Questionnaire {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  introduction?: string;

  @Prop()
  conclusion?: string;

  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop()
  description?: string;

  // Behavior
  @Prop({ required: true, default: false })
  isDynamic: boolean;

  @Prop({ required: true, default: 1 })
  version: number;

  // Flow control
  @Prop()
  startQuestionId?: string;

  @Prop()
  workflowId?: string;

  // Flow control
  @Prop()
  endPhrase: string;

  @Prop({ required: true, default: true })
  allowBackNavigation: boolean;

  @Prop({ required: true, default: false })
  allowMultipleSessions: boolean;

  // Execution mode
  @Prop({
    type: String,
    required: true,
    enum: Object.values(ProcessingStrategy),
    default: ProcessingStrategy.STATIC,
  })
  processingStrategy: ProcessingStrategy;

  // Optional preloaded question tree
  @Prop({ type: [QuestionSchema], default: [] })
  questions?: Question[];

  // Metadata
  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  // State
  @Prop({ required: true, default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const QuestionnaireSchema =
  SchemaFactory.createForClass(Questionnaire);
