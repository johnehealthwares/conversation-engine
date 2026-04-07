import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';

import { EventBusService } from './services/event-bus.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { TransitionService } from './services/transition.service';
import { StepRunnerService } from './services/step-runner.service';
import { WorkflowSubscriber } from './subscribers/subscriber';
import { WorkflowInstance, WorkflowInstanceSchema } from './entities/instance';
import { Workflow, WorkflowSchema } from './entities/workflow';
import { WorkflowEvent, WorkflowEventSchema } from './entities/event';
import { ActionLog, ActionLogSchema } from './entities/action-log';
import { WorkflowHistory, WorkflowHistorySchema } from './entities/workflow-history';
import {
  WorkflowAttachment,
  WorkflowAttachmentSchema,
} from './entities/workflow-attachment';
import { WorkflowInstanceService } from './services/workflow-instance';
import { WorkflowService } from './services/workflow-service';
import { WorkflowProcessorService } from './processors/workflow-processor';
import { WorkflowEventService } from './services/workflow-event-service';
import { WorkflowController } from './controllers/workflow.controller';
import { WorkflowInstanceController } from './controllers/workflow-instance.controller';
import { WorkflowEventController } from './controllers/workflow-event.controller';
import { WorkflowHistoryService } from './services/workflow-history.service';
import { WorkflowAttachmentService } from './services/workflow-attachment.service';
import { WorkflowAttachmentValidationService } from './services/workflow-attachment-validation.service';
import { WorkflowAttachmentController } from './controllers/workflow-attachment.controller';

@Module({
  imports: [
    QuestionnaireModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: Workflow.name, schema: WorkflowSchema },
      { name: WorkflowInstance.name, schema: WorkflowInstanceSchema },
      { name: WorkflowEvent.name, schema: WorkflowEventSchema },
      { name: ActionLog.name, schema: ActionLogSchema },
      { name: WorkflowHistory.name, schema: WorkflowHistorySchema },
      { name: WorkflowAttachment.name, schema: WorkflowAttachmentSchema },
    ]),
  ],
  controllers: [
    WorkflowController,
    WorkflowInstanceController,
    WorkflowEventController,
    WorkflowAttachmentController,
  ],
  providers: [
    EventBusService,
    WorkflowEngineService,
    TransitionService,
    StepRunnerService,
    WorkflowInstanceService,
    WorkflowService,
    WorkflowEventService,
    WorkflowProcessorService,
    WorkflowHistoryService,
    WorkflowAttachmentService,
    WorkflowAttachmentValidationService,
    WorkflowSubscriber,
  ],
  exports: [
    EventBusService,
    WorkflowEngineService,
    WorkflowInstanceService,
    WorkflowService,
    WorkflowEventService,
    WorkflowProcessorService,
    WorkflowHistoryService,
    WorkflowAttachmentService,
    WorkflowAttachmentValidationService,
  ],
})
export class WorkflowEngineModule {}
