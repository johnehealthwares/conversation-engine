import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowEventType } from 'src/modules/workflow/entities/step-transition';
import type { IWorkflowEvent } from 'src/modules/workflow/interfaces/event.interface';
import { ConversationService } from '../services/conversation.service';

@Injectable()
export class ConversationWorkflowEventsSubscriber {
  constructor(private readonly conversationService: ConversationService) {}

  @OnEvent(WorkflowEventType.WORKFLOW_ASK_OPTIONS)
  async handleWorkflowAskOptions(event: IWorkflowEvent) {
    await this.conversationService.handleWorkflowOptions(event.payload);
  }

  @OnEvent(WorkflowEventType.WORKFLOW_NO_OPTIONS_FOUND)
  async handleWorkflowNoOptionsFound(event: IWorkflowEvent) {
    await this.conversationService.handleNoResult(event.payload);
  }
}
