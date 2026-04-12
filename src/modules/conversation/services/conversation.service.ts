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
  ConversationReponseAction,
  ConversationState,
  ConversationStatus,
  ParticipantDomain,
  ProcessMode,
  QuestionDomain,
  QuestionType,
  QuestionnaireDomain,
  RenderMode,
} from '../../../shared/domain';
import { QuestionnaireService } from '../../questionnaire/services/questionnaire.service';
import { QuestionService } from '../../questionnaire/services/question.service';
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
import {
  CreateConversationDto,
  UpdateConversationDto,
} from '../controllers/dto/create-conversation.dto';
import { FilterConversationDto } from '../controllers/dto/filter-conversation.dto';
import { ProcessConversationResponseDto } from '../controllers/dto/process-conversation-response.dto';
import { ChannelService } from '../../../channels/services/channel.service';
import { WorkflowEventType } from 'src/modules/workflow/entities/step-transition';
import { IntentService } from './intent.service';


@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly questionnaireService: QuestionnaireService,
    private readonly questionService: QuestionService,
    private readonly responseService: ResponseService,
    private readonly participantService: ParticipantService,
    private readonly senderFactory: ChannelSenderFactory,
    private readonly channelService: ChannelService,
    private readonly questionProcessor: QuestionProcessorService,
    private readonly workflowProcessor: WorkflowProcessorService,
    private readonly intentService: IntentService,
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
      questionnaireId,
      channelId,
      participantId,
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

  async createConversationRecord(dto: CreateConversationDto): Promise<ConversationDomain> {
    const questionnaire = dto.questionnaireId
      ? await this.questionnaireService.findOne(dto.questionnaireId)
      : dto.questionnaireCode
        ? await this.questionnaireService.findByCode(dto.questionnaireCode)
        : null;

    if (!questionnaire) {
      throw new BadRequestException('Provide a valid questionnaireId or questionnaireCode');
    }
    const participant =
      dto.participantId
        ? await this.participantService.findOne(dto.participantId)
        : await this.participantService.createParticipant({
          id: new Types.ObjectId().toString(),
          phone: dto.phone,
          email: dto.email,
        } as ParticipantDomain);

    if (!dto.channelId) {
      throw new BadRequestException('channelId is required');
    }

    const questions =
      questionnaire.questions && questionnaire.questions.length > 0
        ? questionnaire.questions
        : await this.questionService.findAll({ questionnaireId: questionnaire.id })

    if (!questions.length) {
      throw new BadRequestException('The selected questionnaire has no questions')
    }

    const currentQuestion =
      (dto.currentQuestionId
        ? questions.find((question) => question.id === dto.currentQuestionId)
        : null) ?? [...questions].sort((left, right) => left.index - right.index)[0];

    let created = await this.create(
      questionnaire.id,
      dto.channelId,
      participant.id,
      currentQuestion.id!,
      questions,
    );

    if (created.id) {
      const workflowInstance = await this.workflowProcessor.conversationStarted(
        created.id,
        questionnaire.id,
        participant.phone!,
        questionnaire.code,
      );
      if (workflowInstance?.id) {
        created = await this.conversationRepository.save(created.id, {
          workflowInstanceId: workflowInstance.id,
        });
      }
    }
    return created;
  }

  private buildConversationPayload(
    dto: UpdateConversationDto,
    existing?: ConversationDomain,
    mode: 'replace' | 'patch' = 'patch',
  ) {
    const payload: Partial<ConversationDomain> = {
      questionnaireId: dto.questionnaireId ?? (mode === 'replace' ? existing?.questionnaireId : undefined),
      channelId: dto.channelId ?? (mode === 'replace' ? existing?.channelId : undefined),
      participantId: dto.participantId ?? (mode === 'replace' ? existing?.participantId : undefined),
      currentQuestionId: dto.currentQuestionId ?? (mode === 'replace' ? existing?.currentQuestionId : undefined),
      workflowInstanceId: dto.workflowInstanceId ?? (mode === 'replace' ? existing?.workflowInstanceId : undefined),
      status: dto.status ?? (mode === 'replace' ? existing?.status : undefined),
      state: dto.state ?? (mode === 'replace' ? existing?.state : undefined),
      context: dto.context ?? (mode === 'replace' ? existing?.context : undefined),
      endedAt:
        dto.endedAt !== undefined
          ? new Date(dto.endedAt)
          : mode === 'replace'
            ? existing?.endedAt
            : undefined,
    };

    if (mode === 'patch') {
      return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined),
      ) as Partial<ConversationDomain>;
    }

    return payload;
  }

  async findAll(filter: FilterConversationDto = {}) {
    return this.conversationRepository.findAll(filter);
  }

  async findOne(id: string) {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async replaceConversationRecord(id: string, dto: UpdateConversationDto) {
    const existing = await this.findOne(id);
    return this.conversationRepository.replace(id, this.buildConversationPayload(dto, existing, 'replace'));
  }

  async patchConversationRecord(id: string, dto: UpdateConversationDto) {
    await this.findOne(id);
    return this.conversationRepository.patch(id, this.buildConversationPayload(dto, undefined, 'patch'));
  }

  async updateConversationRecord(id: string, dto: UpdateConversationDto) {
    return this.patchConversationRecord(id, dto);
  }

  async removeConversationRecord(id: string) {
    await this.findOne(id);
    await this.conversationRepository.delete(id);
    return { success: true };
  }

  async findActiveConversationOfParticipant(participanctId: string): Promise<ConversationDomain | null> {
    return this.conversationRepository.findActiveByParticipantId(participanctId);
  }

  async processResponse(id: string, dto: ProcessConversationResponseDto) {
    const conversation = await this.findOne(id);
    const participant = await this.participantService.findOne(conversation.participantId);
    const channel = await this.channelService.findOne(conversation.channelId);
    const questionnaire = await this.questionnaireService.findOne(conversation.questionnaireId);
    return this.processInboundMessage(
      channel,
      participant,
      dto.message,
      questionnaire.code,
      {
        channelId: conversation.channelId,
        conversationId: conversation.id,
        participantId: conversation.participantId,
        questionnaireCode: questionnaire.code,
        messageId: `web-${Date.now()}`,
      },
    );
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

    await sender.sendMessage(participant, question.attribute, message, {
      channelId: conversation.channelId,
      conversationId: conversation.id,
      questionnaireCode: conversation.questionnaireId,
      source: 'conversation_service',
      containsLink: question.renderMode == RenderMode.TEXT_WITH_LINK || question.renderMode === RenderMode.LINK
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

  private async sendInitMessage(channelId: string, participant: ParticipantDomain, message?: string) {
    const resentMessage = false
    const sender = await this.senderFactory.getSender(channelId);
    const questionnaires = await this.questionnaireService.getInitQuestionnaires();
    if (!message)
      message = `Please select an action \n${(questionnaires).map(q => `${q.code}: ${q.name.substring(0, 23)}`).join('\n')}`
    const response = await sender.sendMessage(participant, 'Start', message, { resentMessage });
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
    await sender.sendMessage(participant, questionAttribute || questionId || 'continue', message, {
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

  private resolveNextQuestionFromConversation(
    conversation: ConversationDomain,
    currentQuestion: QuestionDomain,
  ): QuestionDomain | null {
    const questions = conversation.questions ?? [];

    if (currentQuestion.nextQuestionId) {
      const explicitNext = questions.find(
        (question) => question.id === currentQuestion.nextQuestionId,
      );
      if (explicitNext) {
        return explicitNext;
      }
    }

    const orderedQuestions = [...questions].sort((left, right) => left.index - right.index);
    const currentIndex = orderedQuestions.findIndex(
      (question) => question.id === currentQuestion.id,
    );

    return currentIndex >= 0 && currentIndex < orderedQuestions.length - 1
      ? orderedQuestions[currentIndex + 1]
      : null;
  }

  private async completeConversationFromAnswer(
    conversation: ConversationDomain,
    participant: ParticipantDomain,
    currentQuestion: QuestionDomain,
    processedAnswer: string,
    context: MessageContext,
    conversationContext: Record<string, any>,
  ): Promise<ConversationResponse> {
    this.logger.log(
      `[flow:completed] conversation=${conversation.id} questionnaire=${conversation.questionnaireId}`,
    );

    await this.conversationRepository.save(conversation.id!, {
      status: ConversationStatus.COMPLETED,
      state: ConversationState.COMPLETED,
      endedAt: new Date(),
      context: conversationContext,
    });

    const questionnaire = await this.questionnaireService.findOne(conversation.questionnaireId);

    await this.sendMessage(
      conversation,
      questionnaire.conclusion || 'Thank you for completing the questionnaire',
      false,
      false,
      currentQuestion.id,
      currentQuestion.attribute,
    );

    const payload = {
      ...(await this.responseService.getValidResponsesMapByAttribute(conversation.id!)),
      ...conversationContext,
    };
    await this.workflowProcessor.conversationCompleted(
      conversation.id!,
      participant.phone!,
      currentQuestion.attribute,
      processedAnswer,
      payload,
    );

    return {
      responded: true,
      reason: ProcessAnswerStatus.COMPLETED,
      action: ConversationReponseAction.REPLIED_CONVERSATION,
      message: ProcessAnswerStatus.COMPLETED,
      context: {
        questionnaireCode: conversation.questionnaireId,
        participant,
        message: processedAnswer,
        ...context,
      },
    };
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
    let conversation = await this.conversationRepository.findActiveByParticipantId(participant.id);
    let questionnaire: QuestionnaireDomain | null = conversation ? await this.questionnaireService.findOne(conversation.questionnaireId) : await this.questionnaireService.findByCode(questionnaireCode);
    //Scenario 1 : Input that can't be processed was provided
    if (!conversation && !questionnaire) {
      this.logger.warn(
        `[flow:init] No active conversation or questionnaire found for code=${questionnaireCode || 'n/a'}. Finding intent or Sending init message.`,
      );
      try {
        const intentResponse = await this.intentService.classify(message)
        if (!intentResponse.intent || intentResponse.intent === 'UNKNOWN' || Number(intentResponse.confidence) < 0.5) {
          await this.sendInitMessage(channel.id, participant, intentResponse.response);
          return {
            responded: false,
            reason: questionnaireCode ? ProcessAnswerStatus.CONVERSATION_NOT_FOUND : ProcessAnswerStatus.QUESTIONNAIRE_CODE_NOT_PROVIDED,
            action: ConversationReponseAction.SENT_INIT_MESSAGE,
            message: "Please select an action",
            context: { questionnaireCode, }
          };
        }
        questionnaire = await this.questionnaireService.findByCode(intentResponse.intent);

      } catch {
        await this.sendInitMessage(channel.id, participant);
        return {
          responded: false,
          reason: questionnaireCode ? ProcessAnswerStatus.CONVERSATION_NOT_FOUND : ProcessAnswerStatus.QUESTIONNAIRE_CODE_NOT_PROVIDED,
          action: ConversationReponseAction.SENT_INIT_MESSAGE,
          message: "Please select an action",
          context: { questionnaireCode, }
        };
      }

    }

    //Scenario 2 : Questionnaire Found but no conversation, start new conversation
    if (!conversation && questionnaire) {
      this.logger.log(
        `[flow:new] Starting new conversation for questionnaire=${questionnaire.code} participant=${participant.id}`,
      );
      const startQuestion = this.questionnaireService.getStartQuestion(questionnaire);

      conversation = await this.create(questionnaire.id, channel.id, participant.id, startQuestion.id!, questionnaire.questions);

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

      if (conversation.id) {
        const workflowInstance = await this.workflowProcessor.conversationStarted(
          conversation.id,
          questionnaire.id,
          participant.phone!,
          message,
        );
        if (workflowInstance?.id) {
          conversation = await this.conversationRepository.save(conversation.id, {
            workflowInstanceId: workflowInstance.id,
          });
        }
      }

      return {
        responded: true,
        reason: ProcessAnswerStatus.CONVERSATION_NOT_FOUND,
        action: ConversationReponseAction.CREATED_NEW_CONVERSATION,
        message: "CREATED_NEW_CONVERSATION",
        context: { questionnaireCode, channel, participant, message, ...context, conversationId: conversation.id }
      };
    }
    if (conversation?.id) {
      if (conversation.context?.workflow?.pendingQuestion) {
        return this.handleWorkflowResponse(
          conversation,
          participant,
          message,
          context,
        );
      }

      const currentQuestion = await this.getCurrentQuestion(conversation);
      this.logger.debug(
        `[flow:question] conversation=${conversation.id} current=${currentQuestion.attribute} message=${String(message).slice(0, 60)}`,
      );
      if (message === questionnaire?.endPhrase) {
        this.logger.log(
          `[flow:stop] conversation=${conversation.id} received end phrase=${questionnaire?.endPhrase}`,
        );
        await this.stopConversation(conversation.id)
        const resent = false;
        const hasLink = false;
        await this.sendMessage(conversation!, 'You have stopped this conversation, Thank you.', hasLink, resent);
        // ✅ EVENT 2️⃣ -Conversation Stopped

        const payload = {
          ...(await this.responseService.getValidResponsesMapByAttribute(
            conversation.id!,
          )),
          ...(conversation.context || {}),
        };
        await this.workflowProcessor.conversationStopped(
          conversation.id!,
          participant.phone!,
          currentQuestion.attribute,
          message,
          payload,
        );

        return {
          responded: true,
          reason: ProcessAnswerStatus.COMPLETED,
          action: ConversationReponseAction.STOPPED_CONVERSATION,
          message: "Conversation stopped",
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
          action: ConversationReponseAction.COMPLETED_CONVERSATION,
          message: "Conversation completed",
          context: { questionnaireCode, channel, participant, message, ...context }
        };
      }

      const processingResult = await this.questionProcessor.processAnswer(
        conversation,
        currentQuestion,
        message,
      );

      const validInboundResponse =
        processingResult.status !== ProcessAnswerStatus.VALIDATION_ERROR &&
        processingResult.status !== ProcessAnswerStatus.WORKFLOW_HANDLING;

      await this.responseService.saveInboundResponse(
        conversation.id!,
        conversation.participantId,
        currentQuestion.id!,
        currentQuestion.attribute,
        message,
        validInboundResponse,
        validInboundResponse ? (processingResult as any).processedAnswer : undefined,
        processingResult.status === ProcessAnswerStatus.WORKFLOW_HANDLING
          ? {
            workflowPendingSelection: true,
            query: processingResult.value,
          }
          : undefined,
      );

      if (processingResult.status === ProcessAnswerStatus.WORKFLOW_HANDLING) {
        await this.conversationRepository.save(conversation.id!, {
          context: {
            ...conversation.context,
            workflow: {
              step: 'OPTION_KEY_SELECTION',
              event: WorkflowEventType.WORKFLOW_ANSWER_RECEIVED,
              query: processingResult.value,
              resumeQuestionId: currentQuestion.id,
              sourceQuestion: currentQuestion,
            },
          },
          state: ConversationState.PROCESSING,
        });

        const workflowPayload = {
          ...(await this.responseService.getValidResponsesMapByAttribute(
            conversation.id!,
          )),
          ...(conversation.context || {}),
          [currentQuestion.attribute]: processingResult.value,
          answerValue: processingResult.value,
          questionId: currentQuestion.id,
          questionAttribute: currentQuestion.attribute,
          ...(processingResult.metadata || {}),
        };

        await this.workflowProcessor.workflowQuestionAnswered(
          conversation.id,
          participant.phone!,
          currentQuestion.attribute,
          processingResult.value,
          workflowPayload,
        );

        return {
          responded: true,
          reason: processingResult.status,
          action: ConversationReponseAction.PROCESSING_WORKFLOW_ANSWER,
          message,
          context: { questionnaireCode, channel, participant, message, ...context }
        };
      }

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

        const payload = {
          ...(await this.responseService.getValidResponsesMapByAttribute(
            conversation.id!,
          )),
          ...(conversation.context || {}),
        };
        await this.workflowProcessor.answerInValid(
          conversation.id,
          participant.phone!,
          currentQuestion.attribute,
          processingResult.value,
          payload,
        );
        return {
          responded: true,
          reason: processingResult.status,
          action: ConversationReponseAction.REPLIED_CONVERSATION,
          message: processingResult.message,
          context: { questionnaireCode, channel, participant, message, ...context }
        };
      }

      if (processingResult.status === ProcessAnswerStatus.COMPLETED) {
        return this.completeConversationFromAnswer(
          conversation,
          participant,
          currentQuestion,
          String(processingResult.processedAnswer ?? message),
          { questionnaireCode, channel, participant, message, ...context },
          conversation.context || {},
        );
      }

      const updatedConversation = await this.conversationRepository.save(
        conversation.id,
        {
          context: conversation.context,
          state: ConversationState.PROCESSING,
          currentQuestionId: processingResult?.nextQuestion?.id,
        },
      );
      if (processingResult.status === ProcessAnswerStatus.NEXT_QUESTION) {
        await this.sendQuestion(
          updatedConversation,
          processingResult.nextQuestion,
          currentQuestion.id === processingResult.nextQuestion.id
        );
        this.logger.debug(
          `[flow:advance] conversation=${conversation.id} next=${processingResult.nextQuestion.attribute}`,
        );
        // ✅ EVENT 5️⃣ -Answer Valid
        const payload = {
          ...(await this.responseService.getValidResponsesMapByAttribute(
            conversation.id!,
          )),
          ...(conversation.context || {}),
        };
        await this.workflowProcessor.answerValid(
          conversation.id,
          participant.phone!,
          currentQuestion.attribute,
          processingResult.processedAnswer as string,
          payload,
        );

        return {
          responded: true,
          reason: processingResult.status,
          action: ConversationReponseAction.REPLIED_CONVERSATION,
          message: processingResult.status,
          context: { questionnaireCode, channel, participant, message, ...context }
        };
      }
    }
    return {
      responded: true,
      reason: ProcessAnswerStatus.CONVERSATION_NOT_FOUND_FOR_SOME_REASON,
      action: ConversationReponseAction.CONVERSATION_NOT_FOUND,
      message: "Conversation not found",
      context: { questionnaireCode, channel, participant, message, ...context }
    };


  }

  private async handleWorkflowResponse(
    conversation: ConversationDomain,
    participant: ParticipantDomain,
    message: string,
    context: MessageContext,
  ): Promise<ConversationResponse> {
    const wf = conversation.context.workflow;
    const question = wf.pendingQuestion;
    const sourceQuestion =
      wf.sourceQuestion ||
      conversation.questions?.find((item) => item.id === wf.resumeQuestionId);

    const result = await this.questionProcessor.processAnswer(
      conversation,
      question,
      message,
    );

    if (result.status === ProcessAnswerStatus.VALIDATION_ERROR) {
      await this.sendMessage(
        conversation,
        result.message,
        false,
        true,
        question.id,
        question.attribute,
      );

      return {
        responded: true,
        reason: result.status,
        action: ConversationReponseAction.INVALID_ANSWER,
        message: result.message,
        context: { questionnaireCode: conversation.questionnaireId, participant, message, ...context }
      };
    }

    if (wf.step === 'OPTION_KEY_SELECTION') {
      if (!sourceQuestion?.id) {
        throw new NotFoundException('Workflow source question not found');
      }

      const processedAnswer = String((result as any).processedAnswer ?? message.trim());
      const nextQuestion = this.resolveNextQuestionFromConversation(
        conversation,
        sourceQuestion,
      );
      const cleanedContext = {
        ...conversation.context,
        workflow: null,
      };

      await this.responseService.saveInboundResponse(
        conversation.id!,
        conversation.participantId,
        sourceQuestion.id,
        sourceQuestion.attribute,
        message,
        true,
        processedAnswer,
        {
          workflowSelection: {
            query: wf.query,
            optionQuestionId: question.id,
          },
        },
      );

      const updated = await this.conversationRepository.save(conversation.id!, {
        context: cleanedContext,
        currentQuestionId: nextQuestion?.id,
        state: nextQuestion
          ? ConversationState.PROCESSING
          : ConversationState.COMPLETED,
      });

      if (!nextQuestion) {
        return this.completeConversationFromAnswer(
          updated,
          participant,
          sourceQuestion,
          processedAnswer,
          context,
          cleanedContext,
        );
      }

      await this.sendQuestion(updated, nextQuestion, false);

      return {
        responded: true,
        reason: ProcessAnswerStatus.NEXT_QUESTION,
        action: ConversationReponseAction.WORKFLOW_COMPLETED,
        message: "Completed workflow option selection",
        context: { questionnaireCode: '', participant, message, ...context }
      };
    }
    return {
      responded: true,
      reason: ProcessAnswerStatus.WORKFLOW_HANDLING,
      action: ConversationReponseAction.INVALID_ANSWER,
      message: "No Valid Option selected workflow",
      context: { questionnaireCode: '', participant, message, ...context }
    };
  }

  async handleWorkflowOptions(payload) {
    const { conversationId, question, metadata } = payload;

    const conversation = await this.findOne(conversationId);
    const sourceQuestion =
      conversation.context?.workflow?.sourceQuestion ||
      conversation.questions?.find((item) => item.id === conversation.currentQuestionId);
    const normalizedOptions = question.options || [];
    const pendingQuestion: QuestionDomain = {
      id: question.id || new Types.ObjectId().toString(),
      questionnaireId: conversation.questionnaireId,
      attribute:
        question.attribute ||
        metadata?.attribute ||
        `${sourceQuestion?.attribute || 'workflow'}_options`,
      text: question.text,
      questionType: QuestionType.SINGLE_CHOICE,
      renderMode: RenderMode.DROPDOWN,
      processMode: ProcessMode.OPTION_PROCESSED,
      index: sourceQuestion?.index ?? 0,
      isRequired: true,
      tags: ['workflow', 'dynamic-options'],
      nextQuestionId: sourceQuestion?.nextQuestionId,
      options: normalizedOptions,
      validationRules: [],
      isActive: true,
      metadata: {
        ...(question.metadata || {}),
        ...(metadata || {}),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.conversationRepository.save(conversationId, {
      context: {
        ...conversation.context,
        workflow: {
          ...(conversation.context.workflow || {}),
          event: WorkflowEventType.WORKFLOW_ASK_OPTIONS,
          pendingQuestion,
          metadata,
          resumeQuestionId: conversation.currentQuestionId,
          sourceQuestion,
        },
      },
    });

    await this.sendQuestion(conversation, pendingQuestion, false);
  }

  async handleNoResult(payload) {
    const { conversationId, message } = payload;
    const conversation = await this.findOne(conversationId);

    await this.conversationRepository.save(conversationId, {
      state: ConversationState.WAITING_FOR_USER,
      context: {
        ...conversation.context,
        workflow: {
          ...(conversation.context.workflow || {}),
          pendingQuestion: null,
        },
      },
    });

    await this.sendMessage(conversation, message, false, true);

    // ⚠️ DO NOT clear workflow
    // Stay on same question
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
