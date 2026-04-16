import { ProcessAnswerStatus } from "../../modules/questionnaire/processors/question-processor.service";
import { ConversationReponseAction } from ".";
import { MessageContext } from "./message-context.domain";

export interface ConversationResponse {
  responded: boolean;
  reason: ProcessAnswerStatus;
  message: string,
  action: ConversationReponseAction;
  context: MessageContext;
}
