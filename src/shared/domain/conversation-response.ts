import { ProcessAnswerStatus } from "../../modules/questionnaire/processors/question-processor.service";
import { ChannelDomain, ParticipantDomain } from ".";

export interface ConversationResponse {
  responded: boolean;
  reason: ProcessAnswerStatus;
  message: string,
  action: "CREATED_NEW_CONVERSATION" | 'BAD_REQUEST_ERROR' | 'REPLIED_CONVERSATION' | 'SENT_INIT_MESSAGE' | 'STOPPED_CONVERSATION' | 'COMPLETED_CONVERSATION';
  context: {
    questionnaireCode: string;
    [key: string]: any; // allows ...context spread
  };
}
