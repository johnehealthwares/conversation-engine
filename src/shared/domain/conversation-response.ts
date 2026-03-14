import { ProcessAnswerStatus } from "../../modules/conversation/services/question-processor.service";
import { ChannelDomain, ParticipantDomain } from ".";

export interface ConversationResponse {
  responded: boolean;
  reason: ProcessAnswerStatus;
  action: "REPLIED_NEW_CONVERSATION" | 'BAD_REQUEST_ERROR' | 'REPLIED_CONVERSATION' | 'SENT_INIT_MESSAGE' | 'ENDED_CONVERSATION';
  context: {
    questionnaireCode: string;
    [key: string]: any; // allows ...context spread
  };
}
