// schemas/question.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { QuestionType, RenderMode, ProcessMode, ValidationRule } from '../../../shared/domain';
import { Option, OptionSchema } from './option.schema';

@Schema({ timestamps: true })
export class Question {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Questionnaire',
    required: true,
    index: true,
  })
  questionnaireId: Types.ObjectId
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'OptionList',
    required: false,
    index: true,
  })
  optionListId?: Types.ObjectId
  @Prop({ required: true, trim: true })
  attribute: string;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop()
  description?: string;

  @Prop({ required: true, default: false })
  hasLink: boolean;

  @Prop({ required: true })
  index: number;


  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: String, // 👈 REQUIRED
    required: true,
    enum: Object.values(QuestionType),
  })
  questionType: QuestionType;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(RenderMode),
  }) renderMode: RenderMode;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ProcessMode),
  })
  processMode: ProcessMode;

  @Prop({ default: false })
  isRequired: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Question',
    required: false,
    index: true,
  })
  previousQuestionId?: string;


  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Question',
    required: false,
    index: true,
  })
  nextQuestionId?: Types.ObjectId
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Questionnaire',
    required: false,
    index: true,
  })
  childQuestionnaireId?: Types.ObjectId
  @Prop({ type: [OptionSchema], default: [] })
  options?: Option[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  aiConfig?: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  optionSource?: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  apiNavigation?: Record<string, any>;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  validationRules?: ValidationRule[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;

}

export type QuestionDocument = Question & Document;
export const QuestionSchema = SchemaFactory.createForClass(Question);
