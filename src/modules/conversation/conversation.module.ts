import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationService } from './services/conversation.service';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Response, ResponseSchema } from './schemas/response.schema';
import { ConversationRepository } from './repositories/mongo/conversation.repository';
import { ParticipantRepository } from './repositories/mongo/participant.repository';
import { ParticipantService } from './services/participant.service';
import { ResponseService } from './services/ResponseService';
import { Participant, ParticipantSchema } from './schemas/participant.schema';
import { ChannelsModule } from '../../channels/channels.module';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { WorkflowEngineModule } from '../workflow/workflow-engine.module';
import { WorkflowProcessorService } from './processors/workflow-processor.service';
import { ConversationController } from './controllers/conversation.controller';
import { ParticipantController } from './controllers/participant.controller';
import { Question, QuestionSchema } from '../questionnaire/schemas/question.schema';
import { Questionnaire, QuestionnaireSchema } from '../questionnaire/schemas/questionnaire.schema';
import { SharedEventBusModule } from 'src/shared/events';
import { ConversationWorkflowEventsSubscriber } from './subscribers/workflow-events.subscriber';
import { IntentService } from './services/intent.service';
import { HttpModule, HttpService } from '@nestjs/axios';

@Module({
  imports: [
    forwardRef(() => ChannelsModule),
    QuestionnaireModule,
    SharedEventBusModule,
    WorkflowEngineModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Response.name, schema: ResponseSchema },
      { name: Participant.name, schema: ParticipantSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Questionnaire.name, schema: QuestionnaireSchema },
    ]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [ConversationController, ParticipantController],
  providers: [
    IntentService,
    ConversationService,
    ConversationRepository,
    ResponseService,
    ParticipantService,
    ParticipantRepository,
    WorkflowProcessorService,
    ConversationWorkflowEventsSubscriber
  ],
  exports: [ConversationService, ParticipantService, ResponseService],
})
export class ConversationModule {}
