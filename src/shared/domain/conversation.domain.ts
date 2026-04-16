import { ConversationState, ConversationStatus } from "./enums";
import type { QuestionDomain } from ".";
import { MessageContext } from "./message-context.domain";

export type Conversation = {
     id?: string;
     channelId: string;
     questionnaireId: string;
     participantId: string;
     moderatorId: string;
     workflowInstanceId?: string;
     currentQuestionId?: string;
     questions?: QuestionDomain[];
     status: ConversationStatus;
     state: ConversationState;
     startedAt?: Date;
     endedAt?: Date;
     pendingMessages?: string[];
     context: MessageContext;
}
