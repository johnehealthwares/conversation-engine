// schemas/option.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Option {
   @Prop({ type: Types.ObjectId })
   _id: Types.ObjectId
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  value: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  index: number;

  @Prop()
  jumpToQuestionId?: string;

  @Prop()
  backToQuestionId?: string;

  @Prop()
  childQuestionnaireId?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;
}

export type OptionDocument = Option & Document;
export const OptionSchema = SchemaFactory.createForClass(Option);
