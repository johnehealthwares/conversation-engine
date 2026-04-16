import { ProcessMode, QuestionType, RenderMode } from './enums';
import { QuestionOption } from './option.domain';
import { ValidationRule } from '../../modules/questionnaire/domain/validation-rule.domain';

/* -------------------- OPTION SOURCE -------------------- */

export type QuestionDomain = {
  id?: string;
  questionnaireId: string;

  attribute: string;
  text: string;
  description?: string;
  hasLink?: boolean;

  questionType: QuestionType;
  renderMode: RenderMode;
  processMode: ProcessMode;

  index: number;
  isRequired: boolean;

  tags: string[];

  previousQuestionId?: string;
  nextQuestionId?: string;

  childQuestionnaireId?: string;

  // 🔥 STATIC OPTIONS (optional)
  options?: QuestionOption[];
  optionListId?: string;

  validationRules?: ValidationRule[];

  isActive: boolean;

  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt?: Date;
};

export type Question = QuestionDomain;
