import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/* -------------------- TYPES -------------------- */

export type ApiNavigationDocument = ApiNavigation & Document;

@Schema({ _id: false })
export class ApiAuthConfig {
  @Prop({ type: String, enum: ['NONE', 'BEARER', 'API_KEY'], default: 'NONE' })
  type: 'NONE' | 'BEARER' | 'API_KEY';

  @Prop({ type: String })
  tokenKey?: string;

  @Prop({ type: String })
  headerName?: string;
}

@Schema({ _id: false })
export class ApiCondition {
  @Prop({ type: String, required: true })
  condition: string;

  @Prop({ type: String, required: true })
  nextQuestionId: string;
}

@Schema({ _id: false })
export class ApiNavigationConfig {
  @Prop({ type: String, required: true })
  url: string;

  @Prop({ type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' })
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  @Prop({ type: Object, default: {} })
  payloadMapping?: Record<string, any>;

  @Prop({ type: Object, default: {} })
  headers?: Record<string, string>;

  @Prop({ type: ApiAuthConfig })
  auth?: ApiAuthConfig;

  @Prop({ type: [ApiCondition], default: [] })
  conditions?: ApiCondition[];

  @Prop({ type: String })
  defaultNextQuestionId?: string;

  @Prop({ type: Object })
  responseMapping?: {
    metadataKey: string;
  };
}

/* -------------------- MAIN API NAVIGATION SCHEMA -------------------- */

@Schema({ timestamps: true })
export class ApiNavigation {
  @Prop({ required: true, trim: true })
  name: string; // friendly name for this API navigation

  @Prop({ type: ApiNavigationConfig, required: true })
  config: ApiNavigationConfig;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  description?: string;
}

export const ApiNavigationSchema = SchemaFactory.createForClass(ApiNavigation);