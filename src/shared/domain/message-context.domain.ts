import { Question } from "./question.domain";

export type MessageContext = {
  participantId?: string;
  questionnaireCode?: string;
  channelId?: string;
  channelType?: string;
  messageId: string;
  workflow?: {
    step: 'ASK_OPTIONS',
    questionId: string,
    query: string,
    question: Question,
    resumeQuestionId: string
  }
  [key: string]: any
};