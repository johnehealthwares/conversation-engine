import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from '../schemas/response.schema';
import { ResponseDirection } from '../../../shared/domain';
import { Question } from '../../questionnaire/schemas/question.schema';
import { Questionnaire } from '../../questionnaire/schemas/questionnaire.schema';

@Injectable()
export class ResponseService {
  private readonly logger = new Logger(ResponseService.name);

  constructor(
    @InjectModel(Response.name)
    private readonly responseModel: Model<Response>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    @InjectModel(Questionnaire.name)
    private readonly questionnaireModel: Model<Questionnaire>,
  ) { }

  async saveInboundResponse(
    conversationId: string,
    participantId: string,
    questionId: string,
    attribute: string,
    message: string,
    valid: boolean,
    processedAnswer?: unknown,
    metadata?: Record<string, any>,
  ) {
    this.logger.debug(
      `[response:inbound] conversation=${conversationId} question=${attribute} valid=${valid}`,
    );
    return this.responseModel.create({
      conversationId: new Types.ObjectId(conversationId),
      participantId,
      questionId,
      direction: ResponseDirection.INBOUND,
      message,
      textAnswer: this.serializeAnswer(processedAnswer, message),
      attribute,
      metadata,
      valid,
      timestamp: new Date(),
    });
  }

  async markAsValid(responseId: string): Promise<void> {
    await this.responseModel.findByIdAndUpdate(responseId, { valid: true })
    return;
  }

  async saveOutboundResponse(
    conversationId: string,
    participantId: string,
    questionId: string,
    questionAttribute: string,
    message: string,
    valid: boolean,
    metadata?: Record<string, any>,
  ) {
    this.logger.debug(
      `[response:outbound] conversation=${conversationId} question=${questionAttribute} valid=${valid}`,
    );
    return this.responseModel.create({
      conversationId: new Types.ObjectId(conversationId),
      participantId,
      questionId,
      direction: ResponseDirection.OUTBOUND,
      message,
      textAnswer: message,
      attribute: questionAttribute,
      metadata,
      valid,
      timestamp: new Date(),
    });
  }

  async getValidResponsesMapByAttribute(conversationId: string): Promise<Record<string, any>> {
  
    const responses = await this.responseModel.find({
      conversationId: new Types.ObjectId(conversationId),
      direction: ResponseDirection.INBOUND,
      valid: true,
    }).lean();

    this.logger.debug(
      `[response:aggregate] Aggregated ${responses.length} valid inbound responses for conversation=${conversationId}`,
    );
    const result = responses.reduce((acc, r) => {
      if (r.attribute) {
        acc[r.attribute] = r.textAnswer ?? r.message;
      }
      return acc;
    }, {} as Record<string, any>);
    return result;
  }

  private serializeAnswer(processedAnswer: unknown, fallback: string): string {
    if (processedAnswer === undefined || processedAnswer === null) {
      return fallback;
    }

    if (
      typeof processedAnswer === 'object' &&
      processedAnswer !== null &&
      'value' in processedAnswer
    ) {
      const optionValue = (processedAnswer as Record<string, any>).value;
      if (optionValue !== undefined && optionValue !== null) {
        return String(optionValue);
      }
    }

    if (typeof processedAnswer === 'object') {
      return JSON.stringify(processedAnswer);
    }

    return String(processedAnswer);
  }
}
