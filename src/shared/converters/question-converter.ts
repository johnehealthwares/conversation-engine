import { Option } from '../../modules/questionnaire/schemas/option.schema';
import { QuestionDomain, OptionDomain } from '../domain';
import { Question } from '../../modules/questionnaire/schemas/question.schema';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { AIQuestionConfig } from '../domain/ai-question-config';
import { ValidationRule } from '../domain/validation-rule.domain';

export function mapQuestionEntityToDomain(schema: Question): QuestionDomain {
  const populatedOptionList = schema.optionListId as unknown as
    | { _id?: MongooseSchema.Types.ObjectId; options?: Option[] }
    | undefined;
  const optionListOptions = populatedOptionList?.options?.map((option) =>
    mapOptionEntityToDomain(option),
  );

  return {
    ...schema,
    id: schema._id.toString(),
    options: schema.optionListId
      ? optionListOptions || []
      : schema.options?.map(mapOptionEntityToDomain) || [],
    aiConfig: schema.aiConfig as AIQuestionConfig | undefined,
    optionSource: schema.optionSource as QuestionDomain['optionSource'],
    apiNavigation: schema.apiNavigation as QuestionDomain['apiNavigation'],
    validationRules: schema.validationRules as ValidationRule[] | undefined,
    questionnaireId: schema.questionnaireId.toString(),
    childQuestionnaireId: schema.childQuestionnaireId?.toString(),
    previousQuestionId: schema.previousQuestionId?.toString(),
    nextQuestionId: schema.nextQuestionId?.toString(),
    optionListId:
      schema.optionListId instanceof Types.ObjectId        ? schema.optionListId.toString()
        : populatedOptionList?._id?.toString(),
    createdAt: schema.createdAt || new Date(),
  };
}


export function mapOptionEntityToDomain(option: Option): OptionDomain {
  return {
    id: option._id?.toString(),
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
    ...(id ? { _id: id } : {}),
    options: question.options?.map((option) => ({
      _id: option.id ? new MongooseSchema.Types.ObjectId(option.id) : new Types.ObjectId(),
      ...option,
    })),
    // optionSource: question.optionSource,
    // apiNavigation: question.apiNavigation,
    // questionnaireId: new MongooseSchema.Types.ObjectId(question.questionnaireId),
    // childQuestionnaireId: question.childQuestionnaireId && new MongooseSchema.Types.ObjectId(question.childQuestionnaireId),
    // previousQuestionId: question.previousQuestionId && new MongooseSchema.Types.ObjectId(question.previousQuestionId),
    // nextQuestionId: question.nextQuestionId new MongooseSchema.Types.ObjectId(question.nextQuestionId),
  };
  if (question.optionListId) {
    schema.optionListId = new MongooseSchema.Types.ObjectId(question.optionListId);
  }
  return schema;

}
