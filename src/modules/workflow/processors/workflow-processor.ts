// services/workflow-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IWorkflowEvent } from '../interfaces/event.interface';
import { WorkflowInstanceService } from '../services/workflow-instance';
import { WorkflowService } from '../services/workflow-service';
import { evaluateCondition } from '../utils/condition-evaluator';
import { StepRunnerService } from '../services/step-runner.service';
import { WorkflowHistoryService } from '../services/workflow-history.service';
import { WorkflowEventType } from '../entities/step-transition';

@Injectable()
export class WorkflowProcessorService {
  private readonly logger = new Logger(WorkflowProcessorService.name);

  constructor(
    private readonly instanceService: WorkflowInstanceService,
    private readonly workflowService: WorkflowService,
    private readonly stepRunnerService: StepRunnerService,
    private readonly workflowHistoryService: WorkflowHistoryService,
  ) { }

  // ---------------------------
  // GENERIC HANDLER
  // ---------------------------
  private async processEvent(eventType: WorkflowEventType, event: IWorkflowEvent) {
    const workflowInstanceId = event.context?.workflowInstanceId;
    if (!workflowInstanceId) {
      this.logger.warn(
        `[workflow:event] Missing workflowInstanceId for event=${eventType}`,
      );
      return;
    }

    this.logger.debug(
      `[workflow:event] type=${eventType} instance=${workflowInstanceId} step=${event.context?.stepId || 'n/a'}`,
    );

    const instance = await this.instanceService.findById(workflowInstanceId);
    const workflow = await this.workflowService.findById(instance.workflowId);
    if (!workflow) {
      this.logger.error(`Workflow not found: ${instance.workflowId}`);
      return;
    }
    if (!instance.currentStepId) {
      this.logger.warn(`No currentStepId for instance=${workflowInstanceId}`);
      return;
    }
    const step = workflow.steps.find(s => s.id === instance.currentStepId);

    if (!step) {
      this.logger.error(`WorflowInstanceStep not found: for currentStepId ${instance.currentStepId}, will now map with config?.stepAttribute`);
      return;
    }
    const maxTransitionsPerRun = Math.max(1, workflow.maxTransitionsPerRun ?? 25);
    const transitionsRun = Number(instance.state?.__transitionsRun ?? 0);


    if (transitionsRun >= maxTransitionsPerRun) {
      this.logger.warn(
        `[workflow:event] maxTransitionsPerRun reached for instance=${workflowInstanceId}`,
      );
      return;
    }

    // 1️⃣ Merge payload into state
    const updatedState = {
      ...instance.state,
      ...(event.payload || {}),
      __transitionsRun: transitionsRun + 1,
    };

    // const candidates = step.transitions.filter(//TODO:  Is this relevant?
    //   t => t.event === eventType || t.event === '*'
    // );

    // if (!candidates.length) {
    //   this.logger.debug(
    //     `No transitions for event=${eventType} on step=${step.id}`
    //   );
    //   return;
    // }

    await this.workflowHistoryService.record(
      workflowInstanceId,
      instance.currentStepId,
      eventType,
    );

    // 2️⃣ Find matching transition
    const transition = step.transitions.find(t => {
      if (t.event !== eventType) return false;
      return !t.condition || evaluateCondition(t.condition, updatedState);
    });

    if (!transition) return;


    await this.workflowHistoryService.record(
      workflowInstanceId,
      instance.currentStepId,
      eventType,
    );

    // 3️⃣ Move to next step
    const nextStep = workflow.steps.find(s => s.id === transition.nextStepId);

    await this.instanceService.update(instance.id, {
      currentStepId: transition.nextStepId,
      state: updatedState,
    });

    // 4️⃣ Execute step if needed
    if (nextStep) {
      await this.executeStep(nextStep, instance.id, updatedState, workflow.id, event);
    }
  }

  async handleEvent(event: IWorkflowEvent) {
    await this.processEvent(event.type, event);
  }

  // ---------------------------
  // STEP EXECUTION
  // ---------------------------
  private async executeStep(
    step: any,
    workflowInstanceId: string,
    state: Record<string, any>,
    workflowId: string,
    triggerEvent: IWorkflowEvent,
  ) {
    switch (step.type) {
      case 'ACTION':
        await this.stepRunnerService.runStep(
          workflowId,
          step.id,
          workflowInstanceId,
          triggerEvent,
        );
        break;

      case 'END':
        await this.instanceService.update(workflowInstanceId, {
          status: 'COMPLETED',
        });
        break;

      case 'QUESTIONNAIRE':
      case 'WAIT':
      default:
        // do nothing — wait for next event
        break;
    }
  }

  // ---------------------------
  // EVENT HANDLERS
  // ---------------------------

  @OnEvent(WorkflowEventType.CONVERSATION_STARTED)
  async handleConversationStarted(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ANSWER_VALID)
  async handleAnswerValid(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ANSWER_INVALID)
  async handleAnswerInvalid(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ACTION_COMPLETED)
  async handleActionCompleted(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ACTION_FAILED)
  async handleActionFailed(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.CONVERSATION_COMPLETED)
  async handleConversationCompleted(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.CONVERSATION_STOPPED)
  async handleConversationStopped(event: IWorkflowEvent) {
    await this.processEvent(WorkflowEventType.CONVERSATION_STOPPED, event);

    // optionally force stop
    const workflowInstanceId = event.context?.workflowInstanceId;
    if (!workflowInstanceId) {
      return;
    }

    await this.instanceService.update(workflowInstanceId, {
      status: 'STOPPED',
    });
  }
}
