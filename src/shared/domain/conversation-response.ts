import { ProcessAnswerStatus } from "../../modules/questionnaire/processors/question-processor.service";
import { ConversationReponseAction } from ".";

export interface ConversationResponse {
  responded: boolean;
  reason: ProcessAnswerStatus;
  message: string,
  action: ConversationReponseAction;
  context: {
    questionnaireCode: string;
    [key: string]: any; // allows ...context spread
  };
}
