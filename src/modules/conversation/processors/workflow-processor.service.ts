import { Injectable, Logger } from "@nestjs/common";
import { EventBusService } from "src/modules/workflow/services/event-bus.service";
import { WorkflowInstanceService } from "src/modules/workflow/services/workflow-instance";
import { WorkflowInstanceDomain } from "src/shared/domain";

@Injectable()
export class WorkflowProcessorService {
  private readonly logger = new Logger(WorkflowProcessorService.name);

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly workflowInstanceService: WorkflowInstanceService,
  ) { }

  private async dispatch(
    type: string,
    payload: Record<string, any>,
    context: Record<string, any>,
  ) {
    await this.eventBusService.emit(type, payload, context);
  }


  async conversationStarted(workflowInstanceId: string, participant: string, value: string) {
    this.logger.log(`[workflow:conversation-started] instance=${workflowInstanceId} participant=${participant}`);
    await this.dispatch('CONVERSATION_STARTED', {}, { workflowInstanceId, value, participant });
  }

  async conversationStopped(workflowInstanceId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.warn(`[workflow:conversation-stopped] instance=${workflowInstanceId} attribute=${attribute}`);
    await this.dispatch('CONVERSATION_STOPPED', payload, { workflowInstanceId, stepId: attribute, value, participant });
  }

  async answerValid(workflowInstanceId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.debug(`[workflow:answer-valid] instance=${workflowInstanceId} attribute=${attribute}`);
    await this.dispatch('ANSWER_VALID', payload, { workflowInstanceId, stepId: attribute, value, participant });
  }


  async answerInValid(workflowInstanceId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.warn(`[workflow:answer-invalid] instance=${workflowInstanceId} attribute=${attribute}`);
    await this.dispatch('ANSWER_INVALID', payload, { workflowInstanceId, stepId: attribute, value, participant });
  }


  async conversationCompleted(workflowInstanceId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.log(`[workflow:conversation-ended] instance=${workflowInstanceId} attribute=${attribute}`);
    await this.dispatch('CONVERSATION_COMPLETED', payload, { workflowInstanceId, stepId: attribute, value, participant });
  }

  async createWorkFlow(workflowId: string, conversationId: string, trigger: string, attribute: string): Promise<WorkflowInstanceDomain> {
    this.logger.log(`[workflow:create] workflow=${workflowId} conversation=${conversationId} startStep=${attribute}`);
    const workflow = await this.workflowInstanceService.create(
      {
        workflowId,
        flowId: conversationId,
        state: { trigger },
        status: 'ACTIVE',
        currentStepId: attribute,
      }
    );

    return workflow;
  }

} 
