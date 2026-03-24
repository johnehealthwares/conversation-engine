import {
  BadRequestException,
  Injectable,
  Logger,
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
  QuestionnaireDomain,
  QuestionType,
  RenderMode,
} from '../../../shared/domain';
import { QuestionnaireService } from '../../questionnaire/services/questionnaire.service';
import { ChannelSenderFactory } from '../../../channels/senders/channel-sender-factory';
import { ConversationRepository } from '../repositories/mongo/conversation.repository';
import { ResponseService } from './ResponseService';
import { ParticipantService } from './participant.service';
import {
  ProcessAnswerStatus,
  QuestionProcessorService,
} from '../../questionnaire/processors/question-processor.service';
import { ChannelSender } from '../../../channels/senders/channel-sender';
import { ConversationResponse } from '../../../shared/domain/conversation-response';
import { MessageContext } from '../../../shared/domain/message-context.domain';
import { WorkflowProcessorService } from '../processors/workflow-processor.service';


@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly questionnaireService: QuestionnaireService,
    private readonly responseService: ResponseService,
    private readonly participantService: ParticipantService,
    private readonly senderFactory: ChannelSenderFactory,
    private readonly questionProcessor: QuestionProcessorService,
    private readonly workflowProcessor: WorkflowProcessorService,
  ) { }

  async create(
    questionnaireId: string,
    channelId: string,
    participantId: string,
    currentQuestionId: string,
    questions?: QuestionDomain[],
  ): Promise<ConversationDomain> {
    this.logger.log(
      `[flow:create] questionnaire=${questionnaireId} participant=${participantId} channel=${channelId}`,
    );
    const conversation: ConversationDomain = {
      id: new Types.ObjectId().toString(),
      channelId,
      participantId,
      questionnaireId,
      state: ConversationState.START,
      status: ConversationStatus.ACTIVE,
      startedAt: new Date(),
      questions,
      context: {},
    };
    // ✅ EVENT
    const domain = await this.conversationRepository.create({
      ...conversation,
      currentQuestionId,
    });
    return domain;
  }

  async findActiveConversationOfParticipant(participanctId: string): Promise<ConversationDomain | null> {
    return this.conversationRepository.findActiveByParticipantId(participanctId);
  }

  private async sendQuestion(
    conversation: ConversationDomain,
    question: QuestionDomain,
    resent: boolean
  ) {
    const sender: ChannelSender = await this.senderFactory.getSender(conversation.channelId);
    const participant = await this.participantService.findOne(
      conversation.participantId,
    );

    let message = this.questionProcessor.askQuestion(question, conversation);

    await sender.sendMessage(participant, question.attribute, message, question.renderMode == RenderMode.TEXT_WITH_LINK || question.renderMode === RenderMode.LINK,{ 
      channelId: conversation.channelId,
      conversationId: conversation.id,
      questionnaireCode: conversation.questionnaireId,
      source: 'conversation_service',
    });
    await this.conversationRepository.save(conversation.id!, {
      state: ConversationState.WAITING_FOR_USER,
    });
    await this.responseService.saveOutboundResponse(
      conversation.id!,
      conversation.participantId,
      question.id!,
      question.attribute,
      message,
      !resent
    );
  }

  private async sendInitMessage(channelId: string, participant: ParticipantDomain) {
    const resentMessage = false
    const sender = await this.senderFactory.getSender(channelId);
    const questionnaires = await this.questionnaireService.getInitQuestionnaires();
    const message = `Please select an action \n${(questionnaires).map(q => `${q.code}: ${q.name.substring(0, 23)}`).join('\n')}`
    const response = await sender.sendMessage(participant, 'Start', message, resentMessage, {});
    return response;
  }

  private async sendMessage(
    conversation: ConversationDomain,
    message: string,
    containsLink: boolean,
    resent: boolean,
    questionId?: string,
    questionAttribute?: string
  ) {
    const sender = await this.senderFactory.getSender(conversation.channelId);
    const participant = await this.participantService.findOne(
      conversation.participantId,
    );
    await sender.sendMessage(participant, questionAttribute || questionId || 'continue', message, containsLink, {
      channelId: conversation.channelId,
      conversationId: conversation.id,
      source: 'conversation_service',
    });
    if (questionId)
      await this.responseService.saveOutboundResponse(conversation.id!, conversation.participantId, questionId, questionAttribute!, message, !resent);
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
    this.logger.debug(
      `[flow:phone-ingest] phone=${phone} questionnaire=${questionnaireCode || 'n/a'} message=${String(message).slice(0, 40)}`,
    );
    let participant = await this.participantService.findByPhone(phone);
    if (!participant) participant = await this.participantService.createParticipant({ phone } as ParticipantDomain)
    return this.processInboundMessage(channel, participant!, message, questionnaireCode, context);
  }

  async processInboundMessage(
    channel: ChannelDomain,
    participant: ParticipantDomain,
    message: string,
    questionnaireCode: string,
    context: MessageContext,
  ): Promise<ConversationResponse> {
    this.logger.log(
      `[flow:start] participant=${participant.id} channel=${channel.id} questionnaire=${questionnaireCode || 'n/a'}`,
    );
    let result: Record<string, any> = {};
    let conversation = await this.conversationRepository.findActiveByParticipantId(participant.id);
    const questionnaire: QuestionnaireDomain | null = conversation ? await this.questionnaireService.findOne(conversation.questionnaireId) : await this.questionnaireService.findByCode(questionnaireCode);
    //Scenario 1 : Input that can't be processed was provided
    if (!conversation && !questionnaire) {
      this.logger.warn(
        `[flow:init] No active conversation or questionnaire found for code=${questionnaireCode || 'n/a'}. Sending init message.`,
      );
      await this.sendInitMessage(channel.id, participant);
      return {
        responded: false,
        reason: questionnaireCode ? ProcessAnswerStatus.CONVERSATION_NOT_FOUND : ProcessAnswerStatus.QUESTIONNAIRE_CODE_NOT_PROVIDED,
        action: "SENT_INIT_MESSAGE",
        context: { questionnaireCode, }
      };
    }

    //Scenario 2 : Questionnaire Found but no conversation, start new conversation
    if (!conversation && questionnaire) {
      this.logger.log(
        `[flow:new] Starting new conversation for questionnaire=${questionnaire.code} participant=${participant.id}`,
      );
      const startQuestion = this.questionnaireService.getStartQuestion(questionnaire);

      conversation = await this.create(questionnaire.id, channel.id, participant.id, startQuestion.id!, questionnaire.questions);
      if (questionnaire.workflowId) {
       const workflowInstance = await this.workflowProcessor.createWorkFlow(
          questionnaire.workflowId,
          conversation.id!,
          'conversation_started',
          startQuestion.attribute,
        );
        if(workflowInstance)
        conversation = await this.conversationRepository.save(conversation.id!, {
          workflowInstanceId: workflowInstance.id
        });
      }
      const resent = false;
      await this.sendQuestion(conversation, startQuestion, resent);
      conversation = await this.conversationRepository.save(
        conversation.id!,
        {
          state: ConversationState.WAITING_FOR_USER,
          currentQuestionId: startQuestion.id,
        } as Partial<ConversationDomain>,
      );

      // ✅ EVENT 1️⃣  -Conversation Started
      if (conversation.workflowInstanceId) {
        await this.workflowProcessor.conversationStarted(
          conversation.workflowInstanceId,
          participant.phone!,
          message,
        );
      }
      return {
        responded: true,
        reason: ProcessAnswerStatus.CONVERSATION_NOT_FOUND,
        action: "CREATED_NEW_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context, conversationId: conversation.id }
      };
    }
    if (!conversation) {
      this.logger.warn('[flow:orphan] Questionnaire existed but no conversation could be created or resolved.');
      return {
        responded: true,
        reason: ProcessAnswerStatus.CONVERSATION_NOT_FOUND_FOR_SOME_REASON,
        action: "BAD_REQUEST_ERROR",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }
    const currentQuestion = await this.getCurrentQuestion(conversation);
    this.logger.debug(
      `[flow:question] conversation=${conversation.id} current=${currentQuestion.attribute} message=${String(message).slice(0, 60)}`,
    );
    if (message === questionnaire?.endPhrase) {
      this.logger.log(
        `[flow:stop] conversation=${conversation.id} received end phrase=${questionnaire?.endPhrase}`,
      );
      await this.stopConversation(conversation.id!)
      const resent = false;
      const hasLink = false;
      await this.sendMessage(conversation!, 'You have stopped this conversation, Thank you.', hasLink, resent);
      // ✅ EVENT 2️⃣ -Conversation Stopped
     
      if (conversation.workflowInstanceId) {
        const payload = {
          ...(await this.responseService.getValidResponsesMapByAttribute(
            conversation.id!,
          )),
          ...(conversation.context || {}),
        };
        await this.workflowProcessor.conversationStopped(
          conversation.workflowInstanceId,
          participant.phone!,
          currentQuestion.attribute,
          message,
          payload,
        );
      } return {
        responded: true,
        reason: ProcessAnswerStatus.COMPLETED,
        action: "STOPPED_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }
    if (conversation.status === ConversationStatus.COMPLETED) {
      this.logger.verbose?.(
        `[flow:completed] conversation=${conversation.id} already completed. Sending terminal acknowledgement.`,
      );
      const resent = false;
      const hasLink = false;
      await this.sendMessage(conversation!, "Thank you.", hasLink, resent)
      return {
        responded: true,
        reason: ProcessAnswerStatus.COMPLETED,
        action: "COMPLETED_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }

    const processingResult = await this.questionProcessor.processAnswer(
      conversation,
      currentQuestion,
      message,
    );

    await this.responseService.saveInboundResponse(
      conversation.id!,
      conversation.participantId,
      currentQuestion.id!,
      currentQuestion.attribute,
      message,
      processingResult.status !== ProcessAnswerStatus.VALIDATION_ERROR,
      processingResult.status !== ProcessAnswerStatus.VALIDATION_ERROR
        ? processingResult.processedAnswer
        : undefined,
    );

    if (processingResult.status === ProcessAnswerStatus.VALIDATION_ERROR) {
      this.logger.warn(
        `[flow:invalid] conversation=${conversation.id} question=${currentQuestion.attribute}`,
      );
      const resent = true;
      await this.sendMessage(
        conversation,
        processingResult.message,
        Boolean(currentQuestion.hasLink),
        resent,
        currentQuestion.id,
        currentQuestion.attribute,
      );
      // ✅ EVENT 3️⃣ -Answer Invalid 
    
      if (conversation.workflowInstanceId) {
        const payload = {
          ...(await this.responseService.getValidResponsesMapByAttribute(
            conversation.id!,
          )),
          ...(conversation.context || {}),
        };
        await this.workflowProcessor.answerInValid(
          conversation.workflowInstanceId,
          participant.phone!,
          currentQuestion.attribute,
          processingResult.value,
          payload,
        );
      }
      return {
        responded: true,
        reason: processingResult.status,
        action: "REPLIED_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }

    if (processingResult.status === ProcessAnswerStatus.COMPLETED) {
      this.logger.log(
        `[flow:completed] conversation=${conversation.id} questionnaire=${conversation.questionnaireId}`,
      );
      await this.conversationRepository.save(conversation.id!, {
        status: ConversationStatus.COMPLETED,
        state: ConversationState.COMPLETED,
        endedAt: new Date(),
      });
      const questionnaire = await this.questionnaireService.findOne(conversation.questionnaireId)

      await this.sendMessage(
        conversation,
        questionnaire.conclusion || 'Thank you for completing the questionnaire',
        false,
        false,
        currentQuestion.id,
        currentQuestion.attribute,
      );
      // ✅ EVENT 4️⃣ -Conversation Completed
      if (conversation.workflowInstanceId) {
        const payload = {
          ...(await this.responseService.getValidResponsesMapByAttribute(
            conversation.id!,
          )),
          ...(conversation.context || {}),
        };
        await this.workflowProcessor.conversationCompleted(
          conversation.workflowInstanceId,
          participant.phone!,
          currentQuestion.attribute,
          processingResult.processedAnswer as string,
          payload,
        );
      }
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
        context: conversation.context,
        state: ConversationState.PROCESSING,
        currentQuestionId: processingResult.nextQuestion.id,
      },
    );

    await this.sendQuestion(
      updatedConversation,
      processingResult.nextQuestion,
      currentQuestion.id === processingResult.nextQuestion.id
    );
    this.logger.debug(
      `[flow:advance] conversation=${conversation.id} next=${processingResult.nextQuestion.attribute}`,
    );
    // ✅ EVENT 5️⃣ -Answer Valid
    if (conversation.workflowInstanceId) {
      const payload = {
        ...(await this.responseService.getValidResponsesMapByAttribute(
          conversation.id!,
        )),
        ...(conversation.context || {}),
      };
      await this.workflowProcessor.answerValid(
        conversation.workflowInstanceId,
        participant.phone!,
        currentQuestion.attribute,
        processingResult.processedAnswer as string,
        payload,
      );
    }
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
