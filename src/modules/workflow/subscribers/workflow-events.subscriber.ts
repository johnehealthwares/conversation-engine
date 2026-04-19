import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowEventType } from '../entities/step-transition';
import type { IWorkflowEvent } from '../interfaces/event.interface';
import { WorkflowProcessorService } from '../processors/workflow-processor';

@Injectable()
export class WorkflowEventsSubscriber {
  constructor(private readonly workflowProcessor: WorkflowProcessorService) {}

  @OnEvent(WorkflowEventType.CONVERSATION_STARTED)
  async handleConversationStarted(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ANSWER_VALID)
  async handleAnswerValid(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ANSWER_RECEIVED)
  async handleAnswerReceived(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.QUESTION_ASKED)
  async handleQuestionAsked(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ANSWER_INVALID)
  async handleAnswerInvalid(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ACTION_COMPLETED)
  async handleActionCompleted(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.ACTION_FAILED)
  async handleActionFailed(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.CONVERSATION_COMPLETED)
  async handleConversationCompleted(event: IWorkflowEvent) {
    await this.workflowProcessor.handleEvent(event);
  }

  @OnEvent(WorkflowEventType.CONVERSATION_STOPPED)
  async handleConversationStopped(event: IWorkflowEvent) {
    await this.workflowProcessor.handleConversationStopped(event);
  }
}
