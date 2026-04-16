import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Channel } from './channel.schema';
import { Questionnaire } from '../../questionnaire/schemas/questionnaire.schema';
import { Participant } from './participant.schema';
import { Question, QuestionSchema } from '../../questionnaire/schemas/question.schema';
import { ConversationState, ConversationStatus } from '../../../shared/domain';
import { WorkflowInstance } from '../../workflow/entities/instance';
import { type MessageContext } from 'src/shared/domain/message-context.domain';

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  _id: Types.ObjectId
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Participant.name, required: true })
  participantId: Types.ObjectId
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Channel.name, required: true })
  channelId: Types.ObjectId
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Questionnaire.name, required: true })
  questionnaireId: Types.ObjectId
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Question.name, required: true })
  currentQuestionId: Types.ObjectId
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: WorkflowInstance.name })
  workflowInstanceId?: Types.ObjectId

  @Prop({ type: String,
    required: true,
    enum: Object.values(ConversationStatus),
    default: ConversationStatus.ACTIVE })
  status: ConversationStatus;

  @Prop({ type: String,
    required: true, enum: Object.values(ConversationState), default: ConversationState.START })
  state: ConversationState;

  @Prop({ type: [QuestionSchema], default: [] })
  questions?: Question[]; // optional snapshot of questionnaire at start

  @Prop({ type: Object, default: {} })
  context: MessageContext;

  @Prop({ type: Date })
  startedAt?: Date;
  @Prop({ type: Date })
  endedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;

}

export type ConversationDocument = Conversation;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index(
  { participantId: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { status:  ConversationStatus.ACTIVE},
    name: "unique_active_participant"
  }
);
ConversationSchema.index(
  { participantId: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { state:  {$in: [ConversationState.START, ConversationState.PROCESSING, ConversationState.WAITING_FOR_DELIVERY, ConversationState.WAITING_FOR_USER]}},
    name: "unique_processing_participant" 
    
  }
);
