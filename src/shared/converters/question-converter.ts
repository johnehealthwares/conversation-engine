import { Option } from '../../modules/conversation/schemas/option.schema';
import { QuestionnaireDomain, QuestionDomain, OptionDomain } from '../domain';
import { Question } from '../../modules/conversation/schemas/question.schema';
import { Types } from 'mongoose';
import { OptionList } from 'src/modules/conversation/schemas/option-list.schema';

export function mapQuestionEntityToDomain(schema: Question): QuestionDomain {
  const optionListOptions = (schema.optionListId as unknown as any)?.options?.map((option) => mapOptionEntityToDomain(option)); //TODO: this doc issue is dirty
  const domain = {
    ...schema,
    id: schema._id.toString(),
    options: schema.optionListId ? optionListOptions  : schema.options?.map(mapOptionEntityToDomain) || [],
    questionnaireId: schema.questionnaireId.toString(),
    optionListId: schema.optionListId?.toString(),
    createdAt: schema.createdAt || new Date()
  };
  return domain;
  
}


export function mapOptionEntityToDomain(option: Option): OptionDomain {
  return {
    ...option
  };
}

/**
 * Converts a QuestionDomain object to a plain object suitable
 * for Mongoose create/update operations.
 */
export function mapQuestionDomainToShcema({id, ...question}: QuestionDomain): Question{
  const schema: any = {
    ...question,
    _id: new Types.ObjectId(id),
    options: question.options?.map((option) => ({_id: new Types.ObjectId(option.id), ...option})),
    questionnaireId: new Types.ObjectId(question.questionnaireId),
  };
  if (question.optionListId) {
    schema.optionListId = new Types.ObjectId(question.optionListId);
  }
  return schema;

}