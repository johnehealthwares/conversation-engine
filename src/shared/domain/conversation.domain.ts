import { ConversationState, ConversationStatus } from "./enums";
import type { QuestionDomain } from ".";

export type Conversation = {
     id?: string;
     channelId: string;
     questionnaireId: string;
     participantId: string;
     workflowInstanceId?: string;
     currentQuestionId?: string;
     questions?: QuestionDomain[];
     status: ConversationStatus;
     state: ConversationState;
     startedAt?: Date;
     endedAt?: Date;
     pendingMessages?: string[];
     awaitingUserReply?: boolean;
     context: Record<string, any>;
}
