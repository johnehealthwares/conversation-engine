import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';

import { EventBusService } from './services/event-bus.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { TransitionService } from './services/transition.service';
import { StepRunnerService } from './services/step-runner.service';
import { WorkflowSubscriber } from './subscribers/subscriber';
import { WorkflowInstance, WorkflowInstanceSchema } from './entities/instance';
import { Workflow, WorkflowSchema } from './entities/workflow';
import { WorkflowEvent, WorkflowEventSchema } from './entities/event';
import { WorkflowInstanceService } from './services/workflow-instance';
import { WorkflowService } from './services/workflow-service';
import { WorkflowProcessorService } from './processors/workflow-processor';
import { WorkflowEventService } from './services/workflow-event-service';
import { WorkflowController } from './controllers/workflow.controller';
import { WorkflowInstanceController } from './controllers/workflow-instance.controller';
import { WorkflowEventController } from './controllers/workflow-event.controller';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: Workflow.name, schema: WorkflowSchema },
      { name: WorkflowInstance.name, schema: WorkflowInstanceSchema },
      { name: WorkflowEvent.name, schema: WorkflowEventSchema },
    ]),
  ],
  controllers: [
    WorkflowController,
    WorkflowInstanceController,
    WorkflowEventController,
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
    WorkflowSubscriber,
  ],
  exports: [
    EventBusService,
    WorkflowEngineService,
    WorkflowInstanceService,
    WorkflowService,
    WorkflowEventService,
    WorkflowProcessorService,
  ],
})
export class WorkflowEngineModule {}
