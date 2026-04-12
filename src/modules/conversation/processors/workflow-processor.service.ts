import { Injectable, Logger } from "@nestjs/common";
import { EventBusService } from "src/shared/events";
import { WorkflowInstanceService } from "src/modules/workflow/services/workflow-instance";
import { WorkflowInstanceDomain } from "src/shared/domain";
import { QuestionnaireService } from "src/modules/questionnaire/services/questionnaire.service";
import { WorkflowEventContext, WorkflowEventState } from "src/modules/workflow/interfaces/event.interface";
import { WorkflowEventType } from "src/modules/workflow/entities/step-transition";

@Injectable()
export class WorkflowProcessorService {
  private readonly logger = new Logger(WorkflowProcessorService.name);

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly workflowInstanceService: WorkflowInstanceService,
    private readonly questionnaireService: QuestionnaireService,
  ) {}

  private async dispatch(
    type: WorkflowEventType,
    state: WorkflowEventState,
    context: Omit<WorkflowEventContext, 'workflowInstanceId'> & { flowId: string },
  ) {
    const workflowInstance = await this.workflowInstanceService.getActiveByFlowId(context.flowId);
    if (workflowInstance) {
      await this.eventBusService.emit(
        type,
        state,
        {
          ...context,
          flowId: context.flowId,
          workflowInstanceId: workflowInstance.id,
        },
        { source: 'conversation-module' },
      );
      return;
    }
    this.logger.debug(
      `[workflow:dispatch] No active workflow instance for flow=${context.flowId}`,
    );
  }

  async conversationStarted(
    flowId: string,
    questionnaireId: string,
    participant: string,
    value: string,
  ): Promise<WorkflowInstanceDomain | null> {
    this.logger.log(`[workflow:conversation-started] instance=${flowId} participant=${participant}`);
    const questionnaire = await this.questionnaireService.findOne(questionnaireId);
    if (!questionnaire.workflowId) {
      return null;
    }

    const workflowInstance = await this.createWorkFlowInstance(
      questionnaire.workflowId,
      flowId,
      questionnaireId,
      value,
    );
    await this.dispatch(WorkflowEventType.CONVERSATION_STARTED, {}, { flowId, value, participant });
    return workflowInstance;
  }

  async conversationStopped(flowId: string, participant: string, attribute: string, value: string, state: Record<string, string>) {
    this.logger.warn(`[workflow:conversation-stopped] instance=${flowId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_STOPPED, state, { flowId, attribute, value, participant });
  }

  async answerValid(flowId: string, participant: string, attribute: string, value: string, state: Record<string, string>) {
    this.logger.debug(`[workflow:answer-valid] instance=${flowId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_VALID, state, { flowId, attribute, value, participant });
  }


  async answerInValid(flowId: string, participant: string, attribute: string, value: string, state: Record<string, string>) {
    this.logger.warn(`[workflow:answer-invalid] instance=${flowId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_INVALID, state, { flowId,  attribute, value, participant });
  }

  async conversationCompleted(flowId: string, participant: string, attribute: string, value: string, state: Record<string, string>) {
    this.logger.log(`[workflow:conversation-ended] instance=${flowId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_COMPLETED
    , state, { flowId, attribute, value, participant });
  }

 private async createWorkFlowInstance(workflowId: string, flowId: string, trigger: string, attribute: string): Promise<WorkflowInstanceDomain> {
    const existing = await this.workflowInstanceService.getActiveByFlowId(flowId);
    if (existing) {
      return existing;
    }

    this.logger.log(`[workflow:create] workflow=${workflowId} conversation=${flowId} startStep=${attribute}`);
    const workflowInstance = await this.workflowInstanceService.create(
      {
        workflowId,
        flowId: flowId,
        state: { trigger },
        status: 'ACTIVE'
      }
    );

    return workflowInstance;
  }

} 
