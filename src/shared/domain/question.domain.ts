import { ProcessMode, QuestionType, RenderMode } from './enums';
import { QuestionOption } from './option.domain';
import { ValidationRule } from '../../modules/questionnaire/domain/validation-rule.domain';

/* -------------------- API TYPES -------------------- */

export type ApiAuthConfig = {
  type: 'NONE' | 'BEARER' | 'API_KEY';
  tokenKey?: string; // ENV or conversation.metadata key
  headerName?: string; // for API_KEY
};

export type ApiCondition = {
  condition: string;
  nextQuestionId: string;
};

export type ApiNavigationConfig = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payloadMapping?: Record<string, any>;
  headers?: Record<string, string>;
  auth?: ApiAuthConfig;

  conditions?: ApiCondition[];
  defaultNextQuestionId?: string;

  // 🔥 NEW: how response should be mapped into metadata
  responseMapping?: {
    metadataKey: string; // e.g. "matches"
  };
};

/* -------------------- OPTION SOURCE -------------------- */

export type OptionSourceConfig = {
  type: 'STATIC' | 'METADATA';
  metadataKey?: string; // e.g. "matches"
  labelKey?: string;    // e.g. "name"
  valueKey?: string;    // e.g. "id"
  jumpToQuestionId?: string;
};

/* -------------------- QUESTION -------------------- */

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
  aiConfig?: Record<string, any>;

  // 🔥 DYNAMIC OPTIONS (NEW)
  optionSource?: OptionSourceConfig;

  // 🔥 API NAVIGATION (NEW)
  apiNavigation?: ApiNavigationConfig;

  validationRules?: ValidationRule[];

  isActive: boolean;

  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt?: Date;
};

export type Question = QuestionDomain;
