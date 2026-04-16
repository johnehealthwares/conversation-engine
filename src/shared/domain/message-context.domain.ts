import { WorkflowEventType } from "src/modules/workflow/entities/step-transition";
import { Question } from "./question.domain";

export type MessageContext = {
  sender: string;
  questionnaireId: string;
  receiver: string;
  state: Record<string, string>,
  channelId: string;
  messageId: string;
  attribute?: string;
  value?: string;
  workflow?: {
    step: WorkflowEventType,
    sourceQuestionId: string,
    query: string,
    pendingQuestion?: Question,
    resumeQuestionId?: string
  }
  [key: string]: any
};