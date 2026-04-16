// services/workflow-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { IWorkflowEvent } from '../interfaces/event.interface';
import { WorkflowInstanceService } from '../services/workflow-instance';
import { evaluateCondition } from '../utils/condition-evaluator';
import { StepRunnerService } from '../services/step-runner.service';
import { WorkflowHistoryService } from '../services/workflow-history.service';
import { WorkflowEventType } from '../entities/step-transition';
import { WorkflowStep, WorkflowStepType } from '../entities/workflow-step';
import { WorkflowInstance } from 'src/shared/domain/workflow-instance.domain';
import { Workflow } from 'src/shared/domain/workflow.domain';

@Injectable()
export class WorkflowProcessorService {
  private readonly logger = new Logger(WorkflowProcessorService.name);

  constructor(
    private readonly instanceService: WorkflowInstanceService,
    private readonly stepRunnerService: StepRunnerService,
    private readonly workflowHistoryService: WorkflowHistoryService,
  ) {}

  private buildEvaluationContext(
    state: Record<string, any>,
    event: IWorkflowEvent,
  ): Record<string, any> {
    return {
      ...state,
      state,
      payload: {
        ...(event.state || {}),
        answer: event.context?.value,
        attribute: event.context?.attribute,
        receiver: event.context?.receiver,
      },
      context: event.context || {},
      event,
    };
  }

  // ---------------------------
  // GENERIC HANDLER
  // ---------------------------
  private async processEvent(eventType: WorkflowEventType, event: IWorkflowEvent) {
    const workflowInstanceId = event.context.workflowInstanceId;

    this.logger.debug(
      `[workflow:event] type=${eventType} instance=${workflowInstanceId}`,
    );

    const instance = await this.instanceService.findById(workflowInstanceId);
    const workflow = instance.workflowId as Workflow;
    if (!workflow) {
      this.logger.error(`Workflow not found: ${instance.workflowId}`);
      return;
    }


    const step = workflow.steps.find(s => s.id === instance.currentStepId);

    if (!step) {
      this.logger.error(`WorkflowInstanceStep not found: for currentStepId ${instance.currentStepId}, will now map with config?.stepAttribute`);
      return;
    }
    const maxTransitionsPerRun = Math.max(1, workflow.maxTransitionsPerRun ?? 25);
    const sequence = Number(event.meta?.sequence ?? 0);

    if (sequence >= maxTransitionsPerRun) {
      this.logger.warn(
        `[workflow:event] maxTransitionsPerRun reached for instance=${workflowInstanceId}`,
      );
      return;
    }

    // 1️⃣ Merge event payload into instance state
    const updatedState = {
      ...instance.state,
      ...(event.state || {}),
    };
    const evaluationContext = this.buildEvaluationContext(updatedState, event);

    await this.workflowHistoryService.record(
      workflowInstanceId,
      instance.currentStepId,
      eventType,
    );

    // 2️⃣ Find matching transition
    const transition = step.transitions.find(t => {
      if (t.event && t.event !== '*' && t.event !== eventType) return false;
      return !t.condition || evaluateCondition(t.condition, evaluationContext);
    });

    if (!transition) return;

    // 3️⃣ Move to next step
    const nextStep = workflow.steps.find(s => s.id === transition.nextStepId);

    const updatedInstance = await this.instanceService.update(instance.id, {
      currentStepId: transition.nextStepId,
      state: updatedState,
    });

    // 4️⃣ Execute step if needed
    if (nextStep) {
      await this.executeStep(event, nextStep, updatedInstance);
    }

  }

  async handleEvent(event: IWorkflowEvent) {
    await this.processEvent(event.type as WorkflowEventType, event);
  }

  // ---------------------------
  // STEP EXECUTION
  // ---------------------------
  private async executeStep(
    triggerEvent: IWorkflowEvent,
    step: WorkflowStep,
    workflowInstance: WorkflowInstance,
  ) {
    switch (step.type) {
      case WorkflowStepType.ACTION:
        await this.stepRunnerService.runStep(
          triggerEvent,
          step,
          workflowInstance,
        );
        break;

      case WorkflowStepType.END:
        await this.instanceService.update(workflowInstance.id, {
          status: 'COMPLETED',
        });
        break;

      case WorkflowStepType.QUESTIONNAIRE:
      case WorkflowStepType.WAIT:
      default:
        // do nothing — wait for next event
        break;
    }
  }

  // ---------------------------
  // EVENT HANDLERS
  // ---------------------------

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
