import { Injectable } from '@nestjs/common';
import { QuestionDomain } from '../../../shared/domain/question.domain';
import { ConversationDomain } from 'src/shared/domain';

@Injectable()
export class OptionResolver {

  resolve(question: QuestionDomain, conversation: ConversationDomain) {
    if (!question.optionSource) return question.options || [];

    if (question.optionSource.type === 'METADATA') {
      const data =
        conversation.context[question.optionSource.metadataKey || ''] || [];

      return data.map((item: any, index: number) => ({
        key: String(index + 1),
        label:
          item[question.optionSource?.labelKey || 'name'] ||
          item.displayLabel ||
          item.name,
        value:
          item[question.optionSource?.valueKey || 'id'] ||
          item.id ||
          item._id,
        jumpToQuestionId: question.optionSource?.jumpToQuestionId,
      }));
    }

    return question.options || [];
  }
}
