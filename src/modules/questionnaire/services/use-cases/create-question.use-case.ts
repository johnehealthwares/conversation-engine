// usecases/create-question.usecase.ts

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { ProcessMode, QuestionDomain, QuestionType } from "../../../../shared/domain";
import { mapQuestionDomainToShcema } from "../../../../shared/converters/question-converter";
import { QuestionMongoRepository } from "../../repositories/mongo/question.mongorepo";
import { QuestionnaireService } from "../questionnaire.service";

@Injectable()
export class CreateQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionMongoRepository,
    private readonly questionnaireService: QuestionnaireService
  ) { }

  async execute(question: QuestionDomain) {
    const questionnaire = await this.questionnaireService.findOne(question.questionnaireId)

    if (!questionnaire) throw new NotFoundException(`Provided questionnaire ${question.questionnaireId} not found`)
    // TEXT TYPE
    if (question.questionType === QuestionType.TEXT) {
      if (question.options?.length || question.optionListId) {
        throw new BadRequestException(
          'TEXT questions cannot have options or optionListId',
        );
      }
    }

    if (questionnaire.isDynamic) {
      const isDynamicQuestion =
        question.processMode === ProcessMode.AI_PROCESSED ||
        question.processMode === ProcessMode.API_PROCESSED ||
        question.processMode === ProcessMode.WORKFLOW_PROCESSED ||
        question.questionType === QuestionType.AI_OPEN ||
        question.questionType === QuestionType.WORKFLOW_CHOICE;

      if (isDynamicQuestion) {
        throw new Error(
          `Invalid configuration: static questionnaire cannot use dynamic question features (questionId=${question.id})`,
        );
      }
    }

    if (question.processMode === ProcessMode.OPTION_PROCESSED) {
      const hasValidOptions = Array.isArray(question.options) 
        && question.options.length > 0 
        && question.options.some((o) => !o.key?.trim() || !o.label?.trim() || !o.value?.trim());

      if (!hasValidOptions) {
        throw new Error(
          `Invalid configuration: OPTION_PROCESSED question must have options (questionId=${question.id})`,
        );
      }
    }

    // CHOICE TYPES
    if (
      question.questionType === QuestionType.SINGLE_CHOICE ||
      question.questionType === QuestionType.MULTI_CHOICE
    ) {
      if (!question.options?.length && !question.optionListId) {
        throw new BadRequestException(
          'Choice questions must provide either options or optionListId',
        );
      }
    }

    // AI OPEN TYPE
    if (question.questionType === QuestionType.AI_OPEN) {
      if (!question.processMode) {
        throw new BadRequestException(
          'AI_OPEN question must define processMode',
        );
      }

      if (question.processMode !== ProcessMode.AI_PROCESSED) {
        throw new BadRequestException(
          'AI_OPEN question must use AI_PROCESSED processMode',
        );
      }

      if (question.options?.length) {
        throw new BadRequestException(
          'AI_OPEN question cannot have options',
        );
      }
    }
    const schema = mapQuestionDomainToShcema({
      ...question,
      id: question.id || new Types.ObjectId().toString(),
    });
    // 🔹 Create Question
    const created = await this.questionRepository.create(schema);
    // return created question (schema) back to caller
    return created;
  }
}
