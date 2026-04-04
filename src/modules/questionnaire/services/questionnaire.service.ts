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
import { FilterQuestionnaireDto } from '../controllers/dto/filter-questionnaire.dto';

@Injectable()
export class QuestionnaireService {
  constructor(
    @InjectModel(Questionnaire.name)
    private readonly model: Model<Questionnaire>,
  ) {}

  async create(dto: CreateQuestionnaireDto): Promise<QuestionnaireDomain> {
    const response = await this.model.create(dto);
    return this.mapToDomain(response.toObject() as any);
  }

  async findAll(filter: FilterQuestionnaireDto = {}): Promise<QuestionnaireDomain[]> {
    const query = this.buildFilter(filter);
    const results = await this.model.find(query).lean();
    return results.map((item) => this.mapToDomain(item as any));
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
    return this.mapToDomain(result as any);
  }
 
  async findByCode(code: string): Promise<QuestionnaireDomain | null> {
    const result = await this.model.findOne({ code }).populate('questions.optionListId').lean().exec();
    if (!result) return result;
    return this.mapToDomain(result as any);
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

    return this.mapToDomain(updated as any);
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id);
    if (!deleted)
      throw new NotFoundException('Questionnaire not found');

    return { message: 'Questionnaire deleted successfully' };
  }

  async getNextQuestionId(questionnaireId: string, currentQuestionId): Promise<string> {
    const questionnaire = await this.findOne(questionnaireId);
    const orderedQuestions = [...(questionnaire.questions || [])].sort(
      (a, b) => a.index - b.index,
    );
    const currentIndex = orderedQuestions.findIndex((q) => q.id === currentQuestionId);
    const nextQuestion = currentIndex >= 0 ? orderedQuestions[currentIndex + 1] : null;
    if(!nextQuestion) throw new NotFoundException("Question not found")
    return nextQuestion.id!;
  }

  private mapToDomain(schema: Questionnaire & { _id?: any; questions?: any[] }): QuestionnaireDomain {
    const { _id, questions, ...others } = schema as any;
    return {
      ...others,
      id: _id.toString(),
      questions: questions?.map(mapQuestionEntityToDomain),
    };
  }

  private buildFilter(filter: FilterQuestionnaireDto) {
    const query: Record<string, any> = {};

    if (filter.code) query.code = filter.code;
    if (filter.name) query.name = new RegExp(filter.name, 'i');
    if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;

    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { name: regex },
        { code: regex },
        { description: regex },
        { tags: regex },
      ];
    }

    return query;
  }
}
