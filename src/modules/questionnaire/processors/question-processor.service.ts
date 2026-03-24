import { Injectable } from '@nestjs/common';
import {
  ConversationDomain,
  ProcessMode,
  QuestionDomain,
  QuestionType,
  ValidationRule,
} from '../../../shared/domain';
import { AIProcessorService } from './ai-processor.service';
import { ApiProcessorFacade } from './api-processor';
import { OptionResolver } from './option-resolver';

/* -------------------- TYPES -------------------- */

export enum ProcessAnswerStatus {
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NEXT_QUESTION = 'NEXT_QUESTION',
  COMPLETED = 'COMPLETED',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  PARTICIPANT_NOT_FOUND = 'PARTICIPANT_NOT_FOUND',
  QUESTIONNAIRE_NOT_FOUND = 'QUESTIONNAIRE_NOT_FOUND',
  QUESTIONNAIRE_CODE_NOT_PROVIDED = 'QUESTIONNAIRE_CODE_NOT_PROVIDED',
  CONVERSATION_NOT_FOUND_FOR_SOME_REASON = 'CONVERSATION_NOT_FOUND_FOR_SOME_REASON',
}

export type ProcessAnswerResult =
  | {
    status: ProcessAnswerStatus.VALIDATION_ERROR;
    value: string;
    message: string;
  }
  | {
    status: ProcessAnswerStatus.NEXT_QUESTION;
    nextQuestion: QuestionDomain;
    processedAnswer: unknown;
    aiMetadata?: Record<string, any>;
  }
  | {
    status: ProcessAnswerStatus.COMPLETED;
    processedAnswer: unknown;
    aiMetadata?: Record<string, any>;
  };

/* -------------------- SERVICE -------------------- */

@Injectable()
export class QuestionProcessorService {
  constructor(
    private readonly aiProcessor: AIProcessorService,
    private readonly apiProcessor: ApiProcessorFacade, // ✅ injected
    private readonly optionResolver: OptionResolver,
  ) { }

  /* -------------------- ASK -------------------- */

  askQuestion(question: QuestionDomain, conversation?: ConversationDomain) {
    let message = question.text;
    question.options = this.optionResolver.resolve(
      question,
      conversation || ({ context: {} } as ConversationDomain),
    );

    if (question.options?.length) {
      const options = question.options
        .map((option) => `${option.key}: ${option.label}`)
        .join('\n');

      message = `${message}\n${options}`;
    }

    return message;
  }

  /* -------------------- MAIN FLOW -------------------- */

  async processAnswer(
    conversation: ConversationDomain,
    question: QuestionDomain,
    message: string,
  ): Promise<ProcessAnswerResult> {

    // ✅ 1. VALIDATION
    const validationMessage = await this.validateAnswer(question, message);
    if (validationMessage) {
      return {
        value: message.trim(),
        status: ProcessAnswerStatus.VALIDATION_ERROR,
        message: validationMessage,
      };
    }

    // ✅ 2. PROCESSING
    const modeResult = await this.processByMode(
      conversation,
      question,
      message,
    );

    if (modeResult.validationMessage) {
      return {
        value: message.trim(),
        status: ProcessAnswerStatus.VALIDATION_ERROR,
        message: modeResult.validationMessage,
      };
    }

    // ✅ 3. STORE METADATA (important for API flows)
    if (modeResult.metadata) {
      conversation.context = {
        ...conversation.context,
        ...modeResult.metadata,
      };
    }

    // ✅ 4. RESOLVE NEXT QUESTION
    const nextQuestion = this.resolveNextQuestion(
      conversation,
      question,
      modeResult.nextQuestionId,
    );

    if (!nextQuestion) {
      return {
        status: ProcessAnswerStatus.COMPLETED,
        processedAnswer: modeResult.processedAnswer,
        aiMetadata: modeResult.aiMetadata,
      };
    }

    return {
      status: ProcessAnswerStatus.NEXT_QUESTION,
      nextQuestion,
      processedAnswer: modeResult.processedAnswer,
      aiMetadata: modeResult.aiMetadata,
    };
  }

  /* -------------------- VALIDATION -------------------- */

  private async validateAnswer(
    question: QuestionDomain,
    message: string,
  ): Promise<string | null> {
    const answer = message?.trim() ?? '';
    let error = '';

    if (question.isRequired && !answer) {
      error = 'This question requires an answer.';
    }

    for (const rule of question.validationRules ?? []) {
      if (rule.type === 'question-type') {
        error = this.validateAnswerByType(
          question.questionType,
          answer,
          question.options?.map((opt) => opt.key),
        );
      }

      const ruleError = await this.applyRule(answer, rule);
      if (ruleError) error = ruleError;
    }

    return error ? error + ' ' + this.askQuestion(question) : null;
  }

  private async applyRule(
    value: string,
    rule: ValidationRule,
  ): Promise<string | null> {
    switch (rule.type) {
      case 'required':
        return !value ? rule.message || 'This field is required.' : null;

      case 'min':
        return value.length < Number(rule.value ?? 0)
          ? rule.message || `Minimum length is ${rule.value}.`
          : null;

      case 'max':
        return value.length > Number(rule.value ?? Number.MAX_SAFE_INTEGER)
          ? rule.message || `Maximum length is ${rule.value}.`
          : null;

      case 'regex':
        if (!rule.value) return null;
        return new RegExp(String(rule.value)).test(value)
          ? null
          : rule.message || 'Invalid format';

      case 'api':
        return this.validateByAPI(rule.value, value);

      default:
        return null;
    }
  }

  private validateAnswerByType(
    type: QuestionType,
    value: any,
    options?: string[],
  ): string {
    const v = typeof value === 'string' ? value.trim() : value;
    const opts = options?.map((o) => o.toLowerCase()) || [];

    switch (type) {
      case QuestionType.TEXT:
      case QuestionType.AI_OPEN:
        return v ? '' : 'Provide a valid answer';

      case QuestionType.NUMBER:
        return !isNaN(Number(v)) ? '' : 'Provide a valid number';

      case QuestionType.EMAIL:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
          ? ''
          : 'Provide a valid email';

      case QuestionType.SINGLE_CHOICE:
        return opts.includes(v?.toLowerCase())
          ? ''
          : 'Select a valid option';

      default:
        return '';
    }
  }

  private async validateByAPI(api: string, value: string): Promise<string | null> { const result = null; return result }

  /* -------------------- PROCESSING -------------------- */

  private async processByMode(
    conversation: ConversationDomain,
    question: QuestionDomain,
    message: string,
  ): Promise<{
    processedAnswer: unknown;
    nextQuestionId?: string;
    metadata?: Record<string, any>;
    aiMetadata?: Record<string, any>;
    validationMessage?: string;
  }> {

    // ✅ OPTION MODE
    if (question.processMode === ProcessMode.OPTION_PROCESSED) {
      const selected = question.options?.find(
        (o) =>
          o.key.toLowerCase() === message.toLowerCase() ||
          o.label.toLowerCase() === message.toLowerCase(),
      );

      if (!selected) {
        return {
          processedAnswer: message,
          validationMessage: 'Invalid option. ' + this.askQuestion(question),
        };
      }

      return {
        processedAnswer: selected,
        nextQuestionId: selected.jumpToQuestionId,
      };
    }

    // ✅ AI MODE
    if (question.processMode === ProcessMode.AI_PROCESSED) {
      const ai = await this.aiProcessor.analyze(
        message,
        question.aiConfig as any,
      );
      return {
        processedAnswer: ai.structuredResult,
        aiMetadata: { confidence: ai.confidence },
      };
    }

    // ✅ DEFAULT PROCESSING
    const processedAnswer = message.trim();

    // 🚀 API NAVIGATION (delegated)
    if (
      question.processMode === ProcessMode.API_PROCESSED ||
      question.apiNavigation
    ) {
      const apiResult = await this.apiProcessor.execute(
        question.apiNavigation!,
        message,
        conversation,
      );

      return {
        processedAnswer,
        nextQuestionId: apiResult.nextQuestionId,
        metadata: apiResult.metadata,
      };
    }

    return { processedAnswer };
  }

  /* -------------------- NAVIGATION -------------------- */

  private resolveNextQuestion(
    conversation: ConversationDomain,
    current: QuestionDomain,
    overrideId?: string,
  ): QuestionDomain | null {

    const questions = conversation.questions ?? [];

    // 🔹 explicit jump
    if (overrideId) {
      return questions.find((q) => q.id === overrideId) || null;
    }

    // 🔹 fallback sequential
    const ordered = [...questions].sort((a, b) => a.index - b.index);
    const i = ordered.findIndex((q) => q.id === current.id);

    return i >= 0 && i < ordered.length - 1
      ? ordered[i + 1]
      : null;
  }
}
