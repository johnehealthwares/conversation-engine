import { Injectable, Logger } from "@nestjs/common";
import { EventBusService } from "src/shared/events";
import { WorkflowInstanceService } from "src/modules/workflow/services/workflow-instance";
import { WorkflowInstanceDomain } from "src/shared/domain";
import { QuestionnaireService } from "src/modules/questionnaire/services/questionnaire.service";
import { WorkflowEventContext, WorkflowEventPayload } from "src/modules/workflow/interfaces/event.interface";
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
    payload: WorkflowEventPayload,
    context: Omit<WorkflowEventContext, 'workflowInstanceId'> & { conversationId: string },
  ) {
    const workflowInstance = await this.workflowInstanceService.getActiveByFlowId(context.conversationId);
    if (workflowInstance) {
      await this.eventBusService.emit(
        type,
        payload,
        {
          ...context,
          flowId: context.conversationId,
          workflowInstanceId: workflowInstance.id,
        },
        { source: 'conversation-module' },
      );
      return;
    }
    this.logger.debug(
      `[workflow:dispatch] No active workflow instance for conversation=${context.conversationId}`,
    );
  }

  async conversationStarted(
    conversationId: string,
    questionnaireId: string,
    participant: string,
    value: string,
  ): Promise<WorkflowInstanceDomain | null> {
    this.logger.log(`[workflow:conversation-started] instance=${conversationId} participant=${participant}`);
    const questionnaire = await this.questionnaireService.findOne(questionnaireId);
    if (!questionnaire.workflowId) {
      return null;
    }

    const workflowInstance = await this.createWorkFlowInstance(
      questionnaire.workflowId,
      conversationId,
      questionnaireId,
      value,
    );
    await this.dispatch(WorkflowEventType.CONVERSATION_STARTED, {}, { conversationId, value, participant });
    return workflowInstance;
  }

  async conversationStopped(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.warn(`[workflow:conversation-stopped] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_STOPPED, payload, { conversationId, value, participant });
  }

  async answerValid(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.debug(`[workflow:answer-valid] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_VALID, payload, { conversationId, value, participant });
  }


  async answerInValid(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.warn(`[workflow:answer-invalid] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_INVALID, payload, { conversationId, value, participant });
  }

  async workflowQuestionAnswered(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.debug(`[workflow:answer-received] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.WORKFLOW_ANSWER_RECEIVED, payload, { conversationId, value, participant });
  }

  async conversationCompleted(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.log(`[workflow:conversation-ended] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_COMPLETED
    , payload, { conversationId, value, participant });
  }

 private async createWorkFlowInstance(workflowId: string, conversationId: string, trigger: string, attribute: string): Promise<WorkflowInstanceDomain> {
    const existing = await this.workflowInstanceService.getActiveByFlowId(conversationId);
    if (existing) {
      return existing;
    }

    this.logger.log(`[workflow:create] workflow=${workflowId} conversation=${conversationId} startStep=${attribute}`);
    const workflowInstance = await this.workflowInstanceService.create(
      {
        workflowId,
        flowId: conversationId,
        state: { trigger },
        status: 'ACTIVE'
      }
    );

    return workflowInstance;
  }

} 
