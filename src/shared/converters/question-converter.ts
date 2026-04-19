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
    tags: Array.isArray(question.tags) ? question.tags.map(String) : [],
    options: question.options?.map((option) => {
      const mappedOption: any = {
        ...option,
        _id: option.id ? new Types.ObjectId(option.id) : new Types.ObjectId(),
      };
      delete mappedOption.id;
      return mappedOption;
    }) || [],
  };
  // if (question.optionListId) {
  //   const optionListId = question.optionListId;
  //   if (typeof optionListId === 'string' || typeof optionListId === 'number') {
  //     schema.optionListId = new Types.ObjectId(optionListId);
  //   } else if (
  //     optionListId instanceof Types.ObjectId ||
  //     optionListId instanceof MongooseSchema.Types.ObjectId
  //   ) {
  //     schema.optionListId = optionListId;
  //   } else {
  //     schema.optionListId = new Types.ObjectId(
  //       optionListId?.toString?.() ?? optionListId,
  //     );
  //   }
  // }
  return schema;

}
