// repository/question.repository.impl.ts

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Question, QuestionDocument } from "../../schemas/question.schema";
import { InjectModel } from "@nestjs/mongoose";
import { QuestionRepository } from "../question.repository";
import { Model, Types } from "mongoose";
import { FilterQuestionDto } from "../../controllers/dto/filter-question.dto";
import { QuestionDomain } from "../../../../shared/domain";
import { OptionList } from "../../schemas/option-list.schema";
import { ObjectId } from "typeorm";
import { mapQuestionEntityToDomain } from "../../../../shared/converters/question-converter";

@Injectable()
export class QuestionMongoRepository implements QuestionRepository {
  constructor(
    @InjectModel(Question.name)
    private readonly model: Model<QuestionDocument>,
  ) { }
  update(question: Partial<Question>): Promise<Question> {
    throw new Error("Method not implemented.");
  }
  async findById(id: string): Promise<Question | null> {
    const question = await this.model.findById( new Types.ObjectId(id)).populate('optionListId').lean();
    if (question && question.optionListId) question.options = (question?.optionListId as unknown as OptionList).options || question?.options;
    return question;
  }

  create(data: Question) {
    return this.model.create(data);
  }

  async findAll(filter: FilterQuestionDto) {
    const query: any = {};

    if (filter.questionnaireId)
      query.questionnaireId = new Types.ObjectId(filter.questionnaireId);

    if (filter.questionType)
      query.questionType = filter.questionType;

    if (filter.processMode)
      query.processMode = filter.processMode;

    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { text: regex },
        { attribute: regex },
        { description: regex },
        { questionnaireId: regex },
      ];
    }

    const result = await this.model.find(query).populate('options').lean();
    const all = await this.model.find();
    return result;
  }

  async save(id: string, data: Partial<QuestionDomain>): Promise<QuestionDomain> {

    
    // 🔹 Build raw $set update (PATCH semantics)
    const $set: any = {};
    Object.keys(data).forEach((key) => {
      const value = data[key as keyof typeof data];
      if (value !== undefined) $set[key] = value;
    });
    console.log({$set, id})
    const question = await this.model.findByIdAndUpdate(new Types.ObjectId(id), {...$set}, {new: true}).exec();
    if (!question) throw new NotFoundException("Question not foupasnd");
    return question  && mapQuestionEntityToDomain(question?.toObject());
  }

  async delete(id: string) {
    await this.model.findByIdAndDelete(new Types.ObjectId(id));
  }
}
