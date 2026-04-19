import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ConversationDomain,
  ProcessMode,
  QuestionDomain,
  QuestionType,
  ValidationRule,
} from '../../../shared/domain';
import { AIProcessorService } from './ai-processor.service';
import { ApiProcessorFacade } from './api-processor';
import { Types } from 'mongoose';

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
  WORKFLOW_HANDLING = 'WORKFLOW_HANDLING',
  AI_HANDLING = 'AI_HANDLING',
}

export type ProcessAnswerResult =
  | {
    status: ProcessAnswerStatus.VALIDATION_ERROR;
    rawValue: string;
    validationMessage: string;
  }
  | {
    status: ProcessAnswerStatus.NEXT_QUESTION;
    nextQuestion: QuestionDomain;
    processedValue: string;
    rawValue: string;
  }
  | {
    status: ProcessAnswerStatus.COMPLETED;
    processedValue: string;
    rawValue: string;
  }
  | {
    status: ProcessAnswerStatus.WORKFLOW_HANDLING;
    nextQuestion?: QuestionDomain;
    rawValue: string;
    metadata?: Record<string, any>;
  } | {
    status: ProcessAnswerStatus.CONVERSATION_NOT_FOUND;
    rawValue: string;
  };


/* -------------------- SERVICE -------------------- */

@Injectable()
export class QuestionProcessorService {
  constructor(
    private readonly aiProcessor: AIProcessorService,
    private readonly apiProcessor: ApiProcessorFacade, // ✅ injected
  ) { }

  private normalizeId(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    return typeof value === 'string' ? value : String(value);
  }

  private getQuestionId(question: unknown): string | undefined {
    if (!question || typeof question !== 'object') return undefined;
    return this.normalizeId((question as any).id ?? (question as any)._id);
  }

  /* -------------------- ASK -------------------- */

  askQuestion(question: QuestionDomain) {
    let message = question.text;

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
        rawValue: message.trim(),
        status: ProcessAnswerStatus.VALIDATION_ERROR,
        validationMessage,
      };
    }

    // ✅ 2. PROCESSING
    const modeResult = await this.processByMode(
      conversation,
      question,
      message,
    );

    if (modeResult.status === ProcessAnswerStatus.VALIDATION_ERROR) {
      return modeResult;
    }

    return modeResult;
  }

  /* -------------------- VALIDATION -------------------- */

  private async validateAnswer(
    question: QuestionDomain,
    message: string,
  ): Promise<string | null> {
    const answer = message?.trim() ?? '';
    let error: string | null = null;

    if (question.isRequired && !answer) {
      error = 'This question requires an answer.';
    }

    // ✅ OPTION VALIDATION (NEW 🔥)
    if (question.options?.length) {
      const normalized = answer.toLowerCase();

      const isValid = question.options.some(
        (o) =>
          o.key?.trim().toLowerCase() === normalized ||
          o.label?.trim().toLowerCase() === normalized,
      );

      if (!isValid) {
        error = 'Invalid option - ' + answer;
      }
    }

    for (const rule of question.validationRules ?? []) {
      if (rule.type === 'question-type') {
        error = this.validateAnswerByType(
          question.questionType,
          answer,
          question.options?.map((opt) => opt.key),
        );
        if (error) break;

      }

      error = this.applyRule(answer, rule);
      if (error) break;
    }

    return error ? `${error} ${this.askQuestion(question)}` : null;
  }

  private applyRule(
    value: string,
    rule: ValidationRule,
  ): string | null {
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

      default:
        return null;
    }
  }

  private validateAnswerByType(
    type: QuestionType,
    value: any,
    options?: string[],
  ): string | null {
    const v = typeof value === 'string' ? value.trim() : value;
    const opts = options?.map((o) => o.toLowerCase()) || [];

    switch (type) {
      case QuestionType.TEXT:
      case QuestionType.AI_OPEN:
        return v ? null : 'Provide a valid answer';

      case QuestionType.NUMBER:
        return !isNaN(Number(v)) ? null : 'Provide a valid number';

      case QuestionType.EMAIL:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
          ? null
          : 'Provide a valid email';

      case QuestionType.SINGLE_CHOICE:
        return opts.includes(v?.toLowerCase())
          ? null
          : 'Select a valid option';
      case QuestionType.OBJECT_ID:
        return Types.ObjectId.isValid(v)
          ? null
          : 'Provide a valid object id';
      case QuestionType.UUID:
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
          ? null
          : 'Provide a valid uuid';
      default:
        return null;
    }
  }

  private async validateByAPI(api: string, value: string): Promise<string | null> { const result = null; return result }

  /* -------------------- PROCESSING -------------------- */

  private async processByMode(
    conversation: ConversationDomain,
    question: QuestionDomain,
    rawValue: string,
  ): Promise<ProcessAnswerResult> {

    // ✅ OPTION MODE
    if (question.processMode === ProcessMode.OPTION_PROCESSED) {
      const selected = question.options?.find(
        (o) =>
          o.key.trim().toLowerCase() === rawValue.trim().toLowerCase() ||
          o.label.trim().toLowerCase() === rawValue.trim().toLowerCase(),
      );

      if (!selected) {
        return {
          status: ProcessAnswerStatus.VALIDATION_ERROR,
          rawValue,
          validationMessage: 'Invalid option. ' + this.askQuestion(question),
        };
      }
      const nextQuestion = this.resolveNextQuestion(conversation, question, selected.jumpToQuestionId)!

      return {
        status: nextQuestion ? ProcessAnswerStatus.NEXT_QUESTION : ProcessAnswerStatus.COMPLETED,
        nextQuestion,
        processedValue: selected.value,
        rawValue,
      };
    }

    if (question.processMode === ProcessMode.WORKFLOW_PROCESSED) {
      return {
        status: ProcessAnswerStatus.WORKFLOW_HANDLING,
        rawValue,
        nextQuestion: this.resolveNextQuestion(conversation, question)!,
        metadata: {
          workflow: {
            triggerWorkflow: true,
            currentQuestionId: question.id,
            nextQuestionId: question.nextQuestionId,
            query: rawValue,
          }
        },
      }
    }

    // ✅ DEFAULT PROCESSING
    const processedValue = rawValue.trim();


    const nextQuestion = this.resolveNextQuestion(conversation, question);

    if (!nextQuestion) {
      return {
        status: ProcessAnswerStatus.COMPLETED,
        processedValue,
        rawValue,
      };
    }

    return {
      status: ProcessAnswerStatus.NEXT_QUESTION,
      nextQuestion,
      processedValue,
      rawValue,
    };
  }

  /* -------------------- NAVIGATION -------------------- */

  private resolveNextQuestion(
    conversation: ConversationDomain,
    current: QuestionDomain,
    overrideId?: string,
  ): QuestionDomain | null {

    const questions = conversation.questions ?? [];
    const normalizedOverrideId = this.normalizeId(overrideId);
    const normalizedCurrentId = this.normalizeId(current.id);
    const normalizedNextQuestionId = this.normalizeId(current.nextQuestionId);

    // 🔹 explicit jump
    if (normalizedOverrideId) {
      return (
        questions.find((q) => this.getQuestionId(q) === normalizedOverrideId) ||
        null
      );
    }

    if (normalizedNextQuestionId) {
      const question = questions.find(
        (q) => this.getQuestionId(q) === normalizedNextQuestionId,
      );
      if (!question) return null;
      return question;
    }

    // 🔹 fallback sequential
    const ordered = [...questions].sort((a, b) => a.index - b.index);
    const i = ordered.findIndex(
      (q) => this.getQuestionId(q) === normalizedCurrentId,
    );

    return i >= 0 && i < ordered.length - 1
      ? ordered[i + 1]
      : null;
  }
}
