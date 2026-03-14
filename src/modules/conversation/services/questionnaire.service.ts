import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Questionnaire } from '../schemas/questionnaire.schema';
import {
  CreateQuestionnaireDto,
  UpdateQuestionnaireDto,
} from '../controllers/dto/questionnaire.dto';
import { QuestionDomain, QuestionnaireDomain } from '../../../shared/domain';
import { mapQuestionEntityToDomain } from '../../../shared/converters/question-converter';
import { toDomain } from '../../../shared/converters';

@Injectable()
export class QuestionnaireService {
  constructor(
    @InjectModel(Questionnaire.name)
    private readonly model: Model<Questionnaire>,
  ) {}

  async create(dto: CreateQuestionnaireDto): Promise<QuestionnaireDomain> {
    const response = await this.model.create(dto);
    const { _id, questions, ...others} =  response.toObject();
    const domain = {...others, id: _id.toString(), questions: questions?.map(mapQuestionEntityToDomain)};
    return domain;
  }

  async findAll() {
    return this.model.find().lean();
  }

  async getInitQuestionnaires() : Promise<QuestionnaireDomain[]> {
    const questionnnnaires = await this.model.find().lean();
    return questionnnnaires.map(toDomain);
  }

  async findOne(id: string): Promise<QuestionnaireDomain> {
    const result = await this.model.findById(id).populate({
    path: 'questions',
    populate: {
      path: 'optionListId',
      model: 'OptionList'
    }
  }).lean().exec();
    if (!result) throw new NotFoundException('Questionnaire not found');
     const { _id, questions, ...others} =  result;
    const domain = {...others, id: _id.toString(), questions: questions?.map(mapQuestionEntityToDomain)};
    return domain;
  }
 
  async findByCode(code: string): Promise<QuestionnaireDomain | null> {
    const result = await this.model.findOne({ code }).populate('questions.optionListId').lean().exec();
    if (!result) return result;
    const { _id, questions, ...others } = result;
    return {
      ...others,
      id: _id.toString(),
      questions: questions?.map(mapQuestionEntityToDomain),
    };
  }

  getStartQuestion(questionnaire: QuestionnaireDomain): QuestionDomain {
    if (!questionnaire.questions?.length) {
      throw new NotFoundException('Questionnaire has no questions');
    }

    if (questionnaire.startQuestionId) {
      const startQuestion = questionnaire.questions.find(
        (question) => question.id === questionnaire.startQuestionId,
      );
      if (startQuestion) return startQuestion;
    }

    return [...questionnaire.questions].sort((a, b) => a.index - b.index)[0];
  }

  async update(id: string, dto: UpdateQuestionnaireDto): Promise<QuestionnaireDomain> {
    const updated = await this.model.findByIdAndUpdate(
      id,
      { $set: dto },
      { new: true },
    ).lean();

    if (!updated)
      throw new NotFoundException('Questionnaire not found');

    return {...updated, id: updated._id.toString(), questions: updated.questions?.map(mapQuestionEntityToDomain)};
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id);
    if (!deleted)
      throw new NotFoundException('Questionnaire not found');

    return { message: 'Questionnaire deleted successfully' };
  }

  async getNextQuestionId(questionnaireId: string, currentQuestionId): Promise<string> {
    const questionnaire = await this.findOne(questionnaireId);
    const nextQuestion = questionnaire.questions!.find(
      (q) => q.id === currentQuestionId + 1,
    );
    if(!nextQuestion) throw new NotFoundException("Question not found")
    return nextQuestion.id!;
  }
}
