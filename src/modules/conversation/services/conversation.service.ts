import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ChannelDomain,
  ConversationDomain,
  ConversationState,
  ConversationStatus,
  ParticipantDomain,
  QuestionDomain,
} from '../../../shared/domain';
import { QuestionnaireService } from './questionnaire.service';
import { ChannelSenderFactory } from '../../../channels/senders/channel-sender-factory';
import { ConversationRepository } from '../repositories/mongo/conversation.repository';
import { ResponseService } from './ResponseService';
import { ParticipantService } from './participant.service';
import { ProcessAnswerStatus, QuestionProcessorService } from './question-processor.service';
import { Channel } from '../../../shared/domain/channel.domain';
import { ChannelSender } from '../../../channels/senders/channel-sender';
import { ConversationResponse } from '../../../shared/domain/conversation-response';
import { MessageContext } from '../../../shared/domain/message-context.domain';


@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly questionnaireService: QuestionnaireService,
    private readonly responseService: ResponseService,
    private readonly participantService: ParticipantService,
    private readonly senderFactory: ChannelSenderFactory,
    private readonly questionProcessor: QuestionProcessorService,
  ) { }

  async create(
    questionnaireId: string,
    channelId: string,
    participantId: string,
    currentQuestionId: string,
    questions?: QuestionDomain[],
  ): Promise<ConversationDomain> {
    const conversation: ConversationDomain = {
      id: new Types.ObjectId().toString(),
      channelId,
      participantId,
      questionnaireId,
      state: ConversationState.START,
      status: ConversationStatus.ACTIVE,
      startedAt: new Date(),
      questions,
    };

    const schema = await this.conversationRepository.create({
      ...conversation,
      currentQuestionId,
    });
    return schema;
  }

  async findActiveConversationOfParticipant(participanctId: string): Promise<ConversationDomain | null> {
    return this.conversationRepository.findActiveByParticipantId(participanctId);
  }

  private async sendQuestion(
    conversation: ConversationDomain,
    question: QuestionDomain,
  ) {
    const sender: ChannelSender = await this.senderFactory.getSender(conversation.channelId);
    const participant = await this.participantService.findOne(
      conversation.participantId,
    );

      let message = this.questionProcessor.askQuestion(question);

    await sender.sendMessage(participant, message, {
      channelId: conversation.channelId,
      conversationId: conversation.id,
      questionnaireCode: conversation.questionnaireId,
      source: 'conversation_service',
    });
    await this.conversationRepository.save(conversation.id!, {
    state: ConversationState.WAITING_FOR_USER,
  });
    await this.responseService.saveOutboundResponse(
      conversation,
      message,
      question.id,
    );
  }

  private async sendInitMessage(channelId, participant: ParticipantDomain) {
    const sender = await this.senderFactory.getSender(channelId);
    const questionnaires = await this.questionnaireService.getInitQuestionnaires();
    const message = `Please select an action \n${(questionnaires).map(q => `${q.code}: ${q.name.substring(0, 23)}`).join('\n')}`
    const response = await sender.sendMessage(participant, message, {});
    return response;
  }

  private async sendMessage(
    conversation: ConversationDomain,
    message: string,
    questionId?: string,
  ) {
    const sender = await this.senderFactory.getSender(conversation.channelId);
    const participant = await this.participantService.findOne(
      conversation.participantId,
    );
    await sender.sendMessage(participant, message, {
      channelId: conversation.channelId,
      conversationId: conversation.id,
      source: 'conversation_service',
    });
    if(questionId)
    await this.responseService.saveOutboundResponse(conversation, message, questionId);
  }

  private getCurrentQuestion(conversation: ConversationDomain): QuestionDomain {
    const questions = conversation.questions ?? [];
    const questionId = conversation.currentQuestionId;

    const question = questions.find((item) => item.id === questionId);
    if (!question) {
      throw new NotFoundException('Current question not found for conversation');
    }

    return question;
  }
  async processInboundMessageFromPhoneNumber(channel: ChannelDomain, phone: string, message, questionnaireCode: string, context: MessageContext) {
    let participant = await this.participantService.findByPhone(phone);
    if(!participant) participant = await this.participantService.createParticipant({phone} as ParticipantDomain)
    return this.processInboundMessage(channel, participant!, message, questionnaireCode, context);
  }

  async processInboundMessage(
    channel: ChannelDomain,
    participant: ParticipantDomain,
    message: string,
    questionnaireCode: string,
    context: MessageContext,
  ): Promise<ConversationResponse> {
    let result: Record<string, any> = {};
    let conversation = await this.conversationRepository.findActiveByParticipantId(participant.id);
    const questionnaire = conversation ? await this.questionnaireService.findOne(conversation.questionnaireId) : await this.questionnaireService.findByCode(questionnaireCode);
    //Scenario 1 : Input that can't be processed was provided
    if (!conversation && !questionnaire) {
      await this.sendInitMessage(channel, participant);
      return {
        responded: false,
        reason: questionnaireCode ? ProcessAnswerStatus.CONVERSATION_NOT_FOUND : ProcessAnswerStatus.QUESTIONNAIRE_CODE_NOT_PROVIDED,
        action: "SENT_INIT_MESSAGE",
        context: { questionnaireCode,  }
      };
    }

    //Scenario 2 : Questionnaire Found but no conversation, start new conversation
    if (!conversation && questionnaire) {
      const startQuestion = this.questionnaireService.getStartQuestion(questionnaire);

      conversation = await this.create(questionnaire.id, channel.id, participant.id, startQuestion.id!, questionnaire.questions);
      await this.sendQuestion(conversation, startQuestion);
      const progressedConversation = await this.conversationRepository.save(
        conversation.id!,
        {
          state: ConversationState.WAITING_FOR_USER,
          currentQuestionId: startQuestion.id,
        } as Partial<ConversationDomain>,
      );
      return {
        responded: true,
        reason: ProcessAnswerStatus.CONVERSATION_NOT_FOUND,
        action: "REPLIED_NEW_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context, conversationId: conversation.id }
      };
    }
    if (!conversation) {
      return {
        responded: true,
        reason: ProcessAnswerStatus.CONVERSATION_NOT_FOUND_FOR_SOME_REASON,
        action: "REPLIED_NEW_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }
    if(message === questionnaire?.endPhrase) {
     await this.stopConversation(conversation.id!)
     await this.sendMessage(conversation!, questionnaire.conclusion || 'Thank you.')
       return {
        responded: true,
        reason: ProcessAnswerStatus.COMPLETED,
        action: "ENDED_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }
    if (conversation.status === ConversationStatus.COMPLETED) {
      this.sendMessage(conversation!, "Thank you.")
      return {
        responded: true,
        reason: ProcessAnswerStatus.COMPLETED,
        action: "REPLIED_NEW_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }

    const currentQuestion = this.getCurrentQuestion(conversation);
    await this.responseService.saveInboundResponse(
      conversation,
      message,
      currentQuestion.id!,
    );

    const processingResult = await this.questionProcessor.processAnswer(
      conversation,
      currentQuestion,
      message,
    );

    if (processingResult.status === ProcessAnswerStatus.VALIDATION_ERROR) {
      await this.sendMessage(
        conversation,
        processingResult.message,
        currentQuestion.id,
      );
      return {
        responded: true,
        reason: processingResult.status,
        action: "REPLIED_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }

    if (processingResult.status === ProcessAnswerStatus.COMPLETED) {
      await this.conversationRepository.save(conversation.id!, {
        status: ConversationStatus.COMPLETED,
        state: ConversationState.COMPLETED,
        endedAt: new Date(),
      });
      const questionnaire = await this.questionnaireService.findOne(conversation.questionnaireId)

      await this.sendMessage(
        conversation,
        questionnaire.conclusion || 'Thank you for completing the questionnaire',
        currentQuestion.id,
      );
      return {
        responded: true,
        reason: processingResult.status,
        action: "REPLIED_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }

    const updatedConversation = await this.conversationRepository.save(
      conversation.id!,
      {
        state: ConversationState.PROCESSING,
        currentQuestionId: processingResult.nextQuestion.id,
      },
    );

    await this.sendQuestion(
      updatedConversation,
      processingResult.nextQuestion
    );

     return {
        responded: true,
        reason: processingResult.status,
        action: "REPLIED_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };

  }

  async stopConversation(conversationId: string) {
    return this.conversationRepository.save(conversationId, {
      status: ConversationStatus.STOPPED,
      endedAt: new Date(),
    });
  }

  async closeConversation(conversationId: string) {
    return this.conversationRepository.save(conversationId, {
      status: ConversationStatus.COMPLETED,
      state: ConversationState.COMPLETED,
      endedAt: new Date(),
    });
  }
}
