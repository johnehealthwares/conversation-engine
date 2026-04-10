import { Injectable, Logger } from '@nestjs/common';
import { IWorkflowEvent } from '../interfaces/event.interface';
import { TransitionService } from './transition.service';
import { StepRunnerService } from './step-runner.service';
import { WorkflowInstanceService } from './workflow-instance';
import { WorkflowService } from './workflow-service';
import { Workflow } from 'src/shared/domain/workflow.domain';

@Injectable()
export class WorkflowEngineService {
  private logger = new Logger(WorkflowEngineService.name);

  constructor(
    private transitionService: TransitionService,
    private stepRunner: StepRunnerService,
    private workflowInstanceService: WorkflowInstanceService,
    private workflowService: WorkflowService,
  ) {}

  async handleEvent(event: IWorkflowEvent) {
    const workflowInstance =  await this.workflowInstanceService.findById(event.context.workflowInstanceId);
    const workflow =  workflowInstance.workflowId as Workflow
    const step = workflow.steps.find((s) => s.id === workflowInstance?.currentStepId);

    if (!workflow || !step) {
      this.logger.warn(`Workflow or step not found for instance=${event.context.workflowInstanceId}`)
      return;
    }

    const transitions = await this.transitionService.getTransitions(
      workflow.id,
      step.id,
      event.type,
    );

    const matched = transitions.find((t) =>
      this.transitionService.evaluateCondition(t.condition!, event.payload),
    );
        const nestStep = workflow.steps.find((s) => s.id === matched?.toStepId);
    if (!matched || !nestStep) return;

    await this.stepRunner.runStep(
      event,
      nestStep,
      workflowInstance
    );
  }
}
