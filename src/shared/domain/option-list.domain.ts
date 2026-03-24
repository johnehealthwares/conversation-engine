import { QuestionOption } from './option.domain';

export type OptionListDomain = {
  id?: string;
  name: string;
  options: QuestionOption[];
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  tags: string[];
};
