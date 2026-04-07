import { Injectable, Logger } from "@nestjs/common";
import { EventBusService } from "src/modules/workflow/services/event-bus.service";
import { WorkflowInstanceService } from "src/modules/workflow/services/workflow-instance";
import { WorkflowInstanceDomain } from "src/shared/domain";
import { ConversationService } from "../services/conversation.service";
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
  ) { }

  private async dispatch(
    type: WorkflowEventType,
    payload: WorkflowEventPayload,
    context: WorkflowEventContext & {conversationId: string},
  ) {
    const workflowInstance = await this.workflowInstanceService.getActiveByConversationId(context.conversationId);
    if (workflowInstance) {
      context.workflowInstanceId = workflowInstance.id;
      await this.eventBusService.emit(type, payload, context);
    }
  }

  async conversationStarted(conversationId: string, questionnaireId: string, participant: string, value: string) {
    this.logger.log(`[workflow:conversation-started] instance=${conversationId} participant=${participant}`);
      const questionnaire = await this.questionnaireService.findOne(questionnaireId);
      if(questionnaire.workflowId) {
        await this.createWorkFlowInstance(questionnaire.workflowId, conversationId, questionnaireId, value)
      }
    await this.dispatch(WorkflowEventType.CONVERSATION_STARTED, {}, { stepId: 'started', conversationId, value, participant });
  }

  async conversationStopped(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.warn(`[workflow:conversation-stopped] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_STOPPED, payload, { conversationId, stepId: attribute, value, participant });
  }

  async answerValid(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.debug(`[workflow:answer-valid] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_VALID, payload, { conversationId, stepId: attribute, value, participant });
  }


  async answerInValid(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.warn(`[workflow:answer-invalid] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.ANSWER_INVALID, payload, { conversationId, stepId: attribute, value, participant });
  }


  async conversationCompleted(conversationId: string, participant: string, attribute: string, value: string, payload: Record<string, string>) {
    this.logger.log(`[workflow:conversation-ended] instance=${conversationId} attribute=${attribute}`);
    await this.dispatch(WorkflowEventType.CONVERSATION_COMPLETED, payload, { conversationId, stepId: attribute, value, participant });
  }

  async createWorkFlowInstance(workflowId: string, conversationId: string, trigger: string, attribute: string): Promise<WorkflowInstanceDomain> {
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
