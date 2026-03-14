import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { QuestionRepository } from "../../repositories/question.repository";
import { InjectModel } from "@nestjs/mongoose";
import { Option, OptionDocument } from "../../schemas/option.schema";
import { Model, Types } from "mongoose";
import { ProcessMode, QuestionDomain, QuestionType } from "../../../../shared/domain";
import { mapQuestionDomainToShcema } from "../../../../shared/converters/question-converter";
import { randomUUID } from "crypto";
import { Question } from "../../schemas/question.schema";

@Injectable()
export class UpdateQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionRepository,
  ) {}

  async execute(id: string, domain: Partial<QuestionDomain>) : Promise<QuestionDomain> {
    const existing = await this.questionRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Question with id ${id} not found`);
    }

    // TEXT TYPE validation
    // if (domain.questionType && domain.questionType === QuestionType.TEXT) {
    //   if (domain.options?.length || domain.optionListId) {
    //     throw new BadRequestException(
    //       "TEXT questions cannot have options or optionListId"
    //     );
    //   }
    // }

    // // CHOICE TYPES validation
    // if (domain.questionType && 
    //   (domain.questionType === QuestionType.SINGLE_CHOICE ||
    //   domain.questionType === QuestionType.MULTI_CHOICE)
    // ) {
    //   if (!domain.options?.length && !domain.optionListId) {
    //     throw new BadRequestException(
    //       "Choice questions must provide either options or optionListId"
    //     );
    //   }
    // }

    // // AI_OPEN TYPE validation
    // if (domain.questionType && domain.questionType === QuestionType.AI_OPEN) {
    //   if (!domain.processMode) {
    //     throw new BadRequestException(
    //       "AI_OPEN question must define processMode"
    //     );
    //   }

    //   if (domain.processMode !== ProcessMode.AI_PROCESSED) {
    //     throw new BadRequestException(
    //       "AI_OPEN question must use AI_PROCESSED processMode"
    //     );
    //   }

    //   if (domain.options?.length) {
    //     throw new BadRequestException("AI_OPEN question cannot have options");
    //   }
    // }

    // // 🔹 Map options if provided
    // let options: Option[] | undefined = undefined;
    // if (domain.options?.length) {
    //   options = domain.options.map(({ id, ...option }) => ({
    //     _id: new Types.ObjectId(),
    //     ...option,
    //   }));
    // }
    // 🔹 Update question in DB
    return this.questionRepository.save(id, domain);
  }
}