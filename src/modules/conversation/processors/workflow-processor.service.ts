import { Injectable, Logger } from "@nestjs/common";
import { EventBusService } from "src/shared/events";
import { WorkflowInstanceService } from "src/modules/workflow/services/workflow-instance";
import { WorkflowInstanceDomain } from "src/shared/domain";
import { QuestionnaireService } from "src/modules/questionnaire/services/questionnaire.service";
import { WorkflowEventContext, WorkflowEventState } from "src/modules/workflow/interfaces/event.interface";
import { WorkflowEventType } from "src/modules/workflow/entities/step-transition";
import { MessageContext } from "src/shared/domain/message-context.domain";

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
    context: MessageContext
  ): Promise<WorkflowInstanceDomain | null> {
    this.logger.log(`[workflow:conversation-started] instance=${flowId} sender=${context.sender}`);
    const questionnaire = await this.questionnaireService.findOne(context.questionnaireId);
    if (!questionnaire.workflowId) {
      return null;
    }

    const workflowInstance = await this.createWorkFlowInstance(
      questionnaire.workflowId,
      flowId,
      context.questionnaireId,
      context.value!,
    );
    await this.dispatch(WorkflowEventType.CONVERSATION_STARTED, context.state, {...context, flowId});
    return workflowInstance;
  }

  async conversationStopped(flowId: string, context: MessageContext) {
    this.logger.warn(`[workflow:conversation-stopped] instance=${flowId} attribute=${context.attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_STOPPED, context.state, { ...context, flowId });
  }

  async questionAsked(flowId: string, context: MessageContext) {
    this.logger.debug(`[workflow:question-asked] instance=${flowId} attribute=${context.attribute}`);
    await this.dispatch(WorkflowEventType.QUESTION_ASKED, context.state, { ...context, flowId });
  }

  async workflowAnswerReceived(flowId: string, context: MessageContext) {
    this.logger.debug(
      `[workflow:answer-received] instance=${flowId} attribute=${context.attribute}`,
    );
    await this.dispatch(
      WorkflowEventType.WORKFLOW_ANSWER_RECEIVED,
      context.state,
      { ...context, flowId },
    );
  }

  async answerValid(flowId: string, context: MessageContext) {
    this.logger.debug(`[workflow:answer-valid] instance=${flowId} attribute=${context.attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_VALID,  context.state, {...context, flowId});
  }

  async answerInValid(flowId: string, context: MessageContext) {
    this.logger.warn(`[workflow:answer-invalid] instance=${flowId} attribute=${context.attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_INVALID, context.state, {...context, flowId});
  }

  async conversationCompleted(flowId: string, context: MessageContext) {
    this.logger.log(`[workflow:conversation-ended] instance=${flowId} attribute=${context.attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_COMPLETED,  context.state, {...context, flowId});
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
