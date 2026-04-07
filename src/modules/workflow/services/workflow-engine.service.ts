import { Injectable } from '@nestjs/common';
import { IWorkflowEvent } from '../interfaces/event.interface';
import { TransitionService } from './transition.service';
import { StepRunnerService } from './step-runner.service';
import { WorkflowInstanceService } from './workflow-instance';

@Injectable()
export class WorkflowEngineService {
  constructor(
    private transitionService: TransitionService,
    private stepRunner: StepRunnerService,
    private workflowInstanceService: WorkflowInstanceService,
  ) {}

  async handleEvent(event: IWorkflowEvent) {
    const workflowInstance = event.context.workflowInstanceId
      ? await this.workflowInstanceService.findById(event.context.workflowInstanceId)
      : null;
    const workflowId = event.context.workflowId ?? workflowInstance?.workflowId;
    const stepId = event.context.stepId ?? workflowInstance?.currentStepId;

    if (!workflowId || !stepId) {
      return;
    }

    const transitions = await this.transitionService.getTransitions(
      workflowId,
      stepId,
      event.type,
    );

    const matched = transitions.find((t) =>
      this.transitionService.evaluateCondition(t.condition!, event.payload),
    );

    if (!matched) return;

    await this.stepRunner.runStep(
      workflowId,
      matched.toStepId,
      workflowInstance?.id!,
    );
  }
}
