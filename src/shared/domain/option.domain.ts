export type QuestionOption = {
  id?: string;
  key: string;
  label: string;
  value: string;
  index: number;
  groupId?: string;
  jumpToQuestionId?: string;
  backToQuestionId?: string;
  childQuestionnaireId?: string;
  metadata?: Record<string, any>;
};
