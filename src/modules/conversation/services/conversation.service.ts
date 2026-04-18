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
import { WorkflowEventType } from '../../workflow/entities/step-transition';
import { IntentService } from './intent.service';
import { send } from 'process';


@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly questionnaireService: QuestionnaireService,
    private readonly questionService: QuestionService,
    private readonly responseService: ResponseService,
    private readonly participantService: ParticipantService,
    private readonly channelSenderFactory: ChannelSenderFactory,
    private readonly channelService: ChannelService,
    private readonly questionProcessor: QuestionProcessorService,
    private readonly workflowProcessor: WorkflowProcessorService,
    private readonly intentService: IntentService,
  ) { }

  async create(
    questionnaireId: string,
    channelId: string,
    moderatorId: string,
    participantId: string,
    currentQuestionId: string,
    questions: QuestionDomain[],
    context: MessageContext
  ): Promise<ConversationDomain> {
    this.logger.log(
      `[flow:create] questionnaire=${questionnaireId} participant=${participantId} channel=${channelId}`,
    );
    const conversation: ConversationDomain = {
      id: new Types.ObjectId().toString(),
      questionnaireId,
      channelId,
      moderatorId,
      participantId,
      state: ConversationState.START,
      status: ConversationStatus.ACTIVE,
      startedAt: new Date(),
      questions,
      context,
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

    const moderator = participant;//WRONG

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

    const context = {
          sender: participant.phone || participant.email || participant.id,
          receiver: dto.context?.receiver,
          questionnaireId: questionnaire.id,
          state: {},
          attribute: currentQuestion.attribute,
          channelId: dto.channelId,
          messageId: dto.context?.messageId
        }

    let created = await this.create(
      questionnaire.id,
      dto.channelId,
      moderator.id,
      participant.id,
      currentQuestion.id!,
      questions,
      context,
    );

    if (created.id) {
      const workflowInstance = await this.workflowProcessor.conversationStarted(
        created.id,
        {
          sender: participant.phone || participant.email || participant.id,
          receiver: dto.context?.receiver,
          questionnaireId: questionnaire.id,
          state: {},
          attribute: currentQuestion.attribute,
          channelId: dto.channelId,
          messageId: dto.context?.messageId
        }
      );
      if (workflowInstance?.id) {
        created = await this.conversationRepository.save(created.id, { workflowInstanceId: workflowInstance.id });
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
    const channel = await this.channelService.findOne(conversation.channelId);
    if(!channel) throw new NotFoundException('Connversation Channel not found')
    const questionnaire = await this.questionnaireService.findOne(conversation.questionnaireId);
    return this.processInboundMessage(
      channel,
      conversation.moderatorId,
      conversation.participantId,
      dto.message,
      questionnaire.code,
      {
        ...conversation.context
      }
    );
  }

  private async sendQuestion(
    conversation: ConversationDomain,
    question: QuestionDomain,
    resent: boolean,
    context: MessageContext,
  ) {
    if (question.questionType === QuestionType.WORKFLOW_CHOICE) {
      await this.workflowProcessor.questionAsked(conversation.id!, {
        ...context,
        attribute: question.attribute,
      });
      return;
    } else  {
      const sender: ChannelSender = await this.channelSenderFactory.getSender(conversation.channelId);
      const participant = await this.participantService.findOne(
        conversation.participantId,
      );
      this.logger.log(`sendQuestion conversationId=${conversation.id} participantId=${conversation.participantId} moderatorId=${conversation.moderatorId}`);
      const moderator = await this.participantService.findOne(
        conversation.moderatorId,
      );

      let message = this.questionProcessor.askQuestion(question, conversation);

      await sender.sendMessage(moderator!, participant!, question.attribute, message, {//NOTE: participants are reversed here
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
  }

  private async sendInitMessage(channelId: string,  moderator: ParticipantDomain, participant: ParticipantDomain, message?: string) {
    const resentMessage = false
    const channel = await this.channelSenderFactory.getSender(channelId);
    const questionnaires = await this.questionnaireService.getInitQuestionnaires();
    if (!message)
      message = `Please select an action \n${(questionnaires).map(q => `${q.code}: ${q.name.substring(0, 23)}`).join('\n')}`
    const response = await channel.sendMessage(moderator, participant, 'Start', message, { resentMessage });
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
    const channelSender = await this.channelSenderFactory.getSender(conversation.channelId);
    const sender = await this.participantService.findOne(conversation.moderatorId);
    const receiver = await this.participantService.findOne(conversation.participantId);
    await channelSender.sendMessage(sender!, receiver!, questionAttribute || questionId || 'continue', message, {
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

  private async completeConversationFromAnswer(
    conversation: ConversationDomain,
    participant: ParticipantDomain,
    currentQuestion: QuestionDomain,
    processedAnswer: string,
    context: MessageContext,
  ): Promise<ConversationResponse> {
    this.logger.log(
      `[flow:completed] conversation=${conversation.id} questionnaire=${conversation.questionnaireId}`,
    );

    await this.conversationRepository.save(conversation.id!, {
      status: ConversationStatus.COMPLETED,
      state: ConversationState.COMPLETED,
      endedAt: new Date(),
      context,
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

    const state = await this.responseService.getValidResponsesMapByAttribute(conversation.id!)

    await this.workflowProcessor.conversationCompleted(
      conversation.id!,
      { ...context, state }
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

  async processInboundMessage(
    channel: ChannelDomain,
    senderId: string,
    receiverId: string,
    message: string,
    questionnaireCode: string,
    context: MessageContext,
  ): Promise<ConversationResponse> {
    const participant = await this.participantService.findOne(senderId);
    if(!participant) throw new NotFoundException('Participant not Found...')
    const moderator = await this.participantService.findOne(receiverId);
    if(!moderator) throw new NotFoundException('Moderator not Found...')
    this.logger.log(
      `[flow:start] participant=${senderId} channel=${channel.id} questionnaire=${questionnaireCode || 'n/a'}`,
    );
    let conversation = await this.conversationRepository.findActiveByParticipantId(senderId);
    let questionnaire: QuestionnaireDomain | null = conversation ? await this.questionnaireService.findOne(conversation.questionnaireId) : await this.questionnaireService.findByCode(questionnaireCode);
    //Scenario 1 : Input that can't be processed was provided
    if (!conversation && !questionnaire) {
      this.logger.warn(
        `[flow:init] No active conversation or questionnaire found for code=${questionnaireCode || 'n/a'}. Finding intent or Sending init message.`,
      );
      try {
        const intentResponse = await this.intentService.classify(message, participant.phone || participant.id)
        if (!intentResponse.intent || intentResponse.intent === 'UNKNOWN' || (intentResponse.confidence !== undefined && intentResponse.confidence < 0.9)) {
          await this.sendInitMessage(channel.id,moderator, participant, intentResponse.response);
          return {
            responded: false,
            reason: questionnaireCode ? ProcessAnswerStatus.CONVERSATION_NOT_FOUND : ProcessAnswerStatus.QUESTIONNAIRE_CODE_NOT_PROVIDED,
            action: ConversationReponseAction.SENT_INIT_MESSAGE,
            message: "Please select an action",
            context,
          };
        }
        questionnaire = await this.questionnaireService.findByCode(intentResponse.intent);

      } catch {
        await this.sendInitMessage(channel.id, moderator, participant);
        return {
          responded: false,
          reason: questionnaireCode ? ProcessAnswerStatus.CONVERSATION_NOT_FOUND : ProcessAnswerStatus.QUESTIONNAIRE_CODE_NOT_PROVIDED,
          action: ConversationReponseAction.SENT_INIT_MESSAGE,
          message: "Please select an action",
          context
        };
      }

    }

    //Scenario 2 : Questionnaire Found but no conversation, start new conversation
    if (!conversation && questionnaire) {
      this.logger.log(
        `[flow:new] Starting new conversation for questionnaire=${questionnaire.code} participant=${participant.id}`,
      );
      const startQuestion = this.questionnaireService.getStartQuestion(questionnaire);
      const initialContext = {
        sender: participant.id,
        receiver: moderator.id,
        questionnaireId: questionnaire.id,
        state: { message },
        attribute: startQuestion.attribute,
        channelId: channel.id,
        messageId: context.messageId,
      };

      conversation = await this.create(
        questionnaire.id,
        channel.id,
        moderator.id,
        participant.id,
        startQuestion.id!,
        questionnaire.questions || [],
        initialContext,
      );

      const resent = false;
      await this.sendQuestion(conversation, startQuestion, resent, initialContext);
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
          {
            ...initialContext,
            attribute: startQuestion.attribute,
          }
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
        message: "Created a new conversation",
        context: {
          ...initialContext,
          lastAction: ConversationReponseAction.CREATED_NEW_CONVERSATION,
          attribute: startQuestion.attribute,
        },
      };
    }
    if (!conversation || !conversation?.id) {
      return {
        responded: true,
        reason: ProcessAnswerStatus.CONVERSATION_NOT_FOUND_FOR_SOME_REASON,
        action: ConversationReponseAction.CONVERSATION_NOT_FOUND,
        message: "Conversation not found",
        context: { ...context, message, lastAction: ConversationReponseAction.CONVERSATION_NOT_FOUND }
      };
    }
    if (conversation.context?.workflow?.pendingQuestion) {
      return this.handleWorkflowResponse(
        conversation,
        participant,
        message
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

      const state = await this.responseService.getValidResponsesMapByAttribute(conversation.id!)
      await this.workflowProcessor.conversationStopped(
        conversation.id!,
        {
          ...context,
          state,
        }
      );

      return {
        responded: true,
        reason: ProcessAnswerStatus.COMPLETED,
        action: ConversationReponseAction.STOPPED_CONVERSATION,
        message: "Conversation stopped",
        context: { ...context, state }
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
        context: { ...context }
      };
    }
    if (
      currentQuestion.questionType === QuestionType.WORKFLOW_CHOICE &&
      !conversation.context?.workflow?.pendingQuestion
    ) {
      return {
        responded: true,
        reason: ProcessAnswerStatus.WORKFLOW_HANDLING,
        action: ConversationReponseAction.PROCESSING_WORKFLOW_ANSWER,
        message: 'Loading options for the current step.',
        context: { questionnaireCode, channel, participant, message, ...context },
      };
    }

    const processingResult = await this.questionProcessor.processAnswer(
      conversation,
      currentQuestion,
      message,
    );

    const validInboundResponse =
      processingResult.status !== ProcessAnswerStatus.VALIDATION_ERROR

    await this.responseService.saveInboundResponse(
      conversation.id!,
      conversation.participantId,
      currentQuestion.id!,
      currentQuestion.attribute,
      message,
      validInboundResponse,
      validInboundResponse
        ? ((processingResult as any).processedValue ?? processingResult.rawValue)
        : undefined,
      processingResult.status === ProcessAnswerStatus.WORKFLOW_HANDLING
        ? {
          workflowPendingSelection: true,
          query: processingResult.rawValue,
        }
        : undefined,
    );

    const state = await this.responseService.getValidResponsesMapByAttribute(conversation.id!)

    if (processingResult.status === ProcessAnswerStatus.VALIDATION_ERROR) {
      this.logger.warn(`[flow:invalid] conversation=${conversation.id} question=${currentQuestion.attribute} value=${processingResult.rawValue}`);

      // ✅ EVENT 3️⃣ -Answer Invalid 

      await this.workflowProcessor.answerInValid(conversation.id, { ...context, state, attribute: currentQuestion.attribute });

      // Only send manual message if workflow didn't take over (no instance or no transition)
      const resent = true;
      await this.sendMessage(
        conversation,
        processingResult.validationMessage,
        Boolean(currentQuestion.hasLink),
        resent,
        currentQuestion.id,
        currentQuestion.attribute,
      );

      return {
        responded: true,
        reason: processingResult.status,
        action: ConversationReponseAction.REPLIED_CONVERSATION,
        message: processingResult.validationMessage,
        context: { questionnaireCode, channel, participant, message, ...context }
      };
    }

    if (processingResult.status === ProcessAnswerStatus.WORKFLOW_HANDLING) {
      await this.conversationRepository.save(conversation.id!, {
        state: ConversationState.PROCESSING,
        context: {
          ...conversation.context,
          workflow: {
            ...(conversation.context?.workflow || {}),
            step: WorkflowEventType.WORKFLOW_ANSWER_RECEIVED,
            sourceQuestionId: currentQuestion.id!,
            query: processingResult.rawValue,
            resumeQuestionId: currentQuestion.id,
          },
        },
      });

      await this.workflowProcessor.workflowAnswerReceived(conversation.id, {
        ...context,
        attribute: currentQuestion.attribute,
        value: processingResult.rawValue,
        state,
      });

      return {
        responded: true,
        reason: processingResult.status,
        action: ConversationReponseAction.PROCESSING_WORKFLOW_ANSWER,
        message,
        context: { ...context, message }
      };
    }

    if (validInboundResponse) {
      // ✅ EVENT 5️⃣ -Answer Valid
      await this.workflowProcessor.answerValid(conversation.id, {
        ...context,
        attribute: currentQuestion.attribute,
        value: (processingResult as any).processedValue,
        state,
      });
    }

    if (processingResult.status === ProcessAnswerStatus.NEXT_QUESTION) {
      const updatedConversation = await this.conversationRepository.save(
        conversation.id,
        {
          // Removed context: conversation.context to prevent overwriting async updates
          state: ConversationState.PROCESSING,
          currentQuestionId: processingResult?.nextQuestion?.id,
        },
      );
      const state = await this.responseService.getValidResponsesMapByAttribute(conversation.id!);
      await this.sendQuestion(
        updatedConversation,
        processingResult.nextQuestion,
        currentQuestion.id === processingResult.nextQuestion.id,
        {
          ...context,
          attribute: processingResult.nextQuestion.attribute,
          state,
        }
      );
      this.logger.debug(
        `[flow:advance] conversation=${conversation.id} next=${processingResult.nextQuestion.attribute}`,
      );
      return {
        responded: true,
        reason: processingResult.status,
        action: ConversationReponseAction.REPLIED_CONVERSATION,
        message: processingResult.status,
        context: { ...context, state, }
      };
    }

    if (processingResult.status === ProcessAnswerStatus.COMPLETED) {
      return this.completeConversationFromAnswer(
        conversation,
        participant,
        currentQuestion,
        String(processingResult.processedValue ?? message),
        { questionnaireCode, channel, participant, message, ...context },

      );
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
  ): Promise<ConversationResponse> {
    const wf = conversation.context.workflow as { step: WorkflowEventType; sourceQuestionId: string; query: string; pendingQuestion?: any };
    const context = {...conversation.context}
    const sourceQuestion = conversation.questions?.find((item) => item.id === wf.sourceQuestionId);

    if (!sourceQuestion) {
      throw new NotFoundException('Workflow source question not found');
    }

    const pendingQuestion: QuestionDomain = {
      ...sourceQuestion,
      ...wf.pendingQuestion
    };
    const result = await this.questionProcessor.processAnswer(
      conversation,
      pendingQuestion,
      message,
    );

    if (result.status === ProcessAnswerStatus.VALIDATION_ERROR) {
      await this.sendMessage(
        conversation,
        result.validationMessage,
        false,
        true,
        pendingQuestion.id,
        pendingQuestion.attribute,
      );

      return {
        responded: true,
        reason: result.status,
        action: ConversationReponseAction.INVALID_ANSWER,
        message: result.validationMessage,
        context: { questionnaireCode: conversation.questionnaireId, participant, message, ...context }
      };
    }

    if (result.status === ProcessAnswerStatus.NEXT_QUESTION) {
      if (!sourceQuestion?.id) {
        throw new NotFoundException('Workflow source question not found');
      }
      const nextQuestion = result.nextQuestion
      const cleanedContext = {
        ...conversation.context,
        workflow: undefined,
      };

      await this.responseService.saveInboundResponse(
        conversation.id!,
        conversation.participantId,
        sourceQuestion.id,
        sourceQuestion.attribute,
        message,
        true,
        result.processedValue,
        {
          workflowSelection: {
            query: wf.query,
            optionQuestionId: sourceQuestion.id,
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
          result.processedValue,
          cleanedContext,
        );
      }

      const state = await this.responseService.getValidResponsesMapByAttribute(conversation.id!);
      await this.sendQuestion(updated, nextQuestion, false, { ...context, attribute: nextQuestion.attribute, state });

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
    const conversationId = payload.flowId || payload.conversationId;
    const { question, metadata } = payload;

    const conversation = await this.findOne(conversationId);

    const sourceQuestion = conversation.questions?.find((item) => item.id === conversation.currentQuestionId);
    const sourceWorkflow = conversation.context.workflow || {
      step: WorkflowEventType.WORKFLOW_ANSWER_RECEIVED,
      sourceQuestionId: sourceQuestion?.id!,
      query: '',
    };

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

    const context: MessageContext = {
      ...conversation.context,
      workflow: {
        ...sourceWorkflow,
        pendingQuestion,
      } as any,
    };
    const response = await this.conversationRepository.save(conversationId, { context });

    await this.sendQuestion(response, pendingQuestion, false, context);
  }

  async handleNoResult(payload) {
    const conversationId = payload.flowId || payload.conversationId;
    const { message } = payload;
    const conversation = await this.findOne(conversationId);
    const currentQuestion = conversation.questions?.find(
      (item) => item.id === conversation.currentQuestionId,
    );
    const sourceWorkflow = conversation.context.workflow || {
      sourceQuestionId: conversation.currentQuestionId!,
      query: '',
    };
    const resumeQuestionId =
      currentQuestion?.questionType === QuestionType.WORKFLOW_CHOICE
        ? currentQuestion.previousQuestionId || conversation.currentQuestionId
        : conversation.currentQuestionId;

    await this.conversationRepository.save(conversationId, {
      currentQuestionId: resumeQuestionId,
      state: ConversationState.WAITING_FOR_USER,
      context: {
        ...conversation.context,
        workflow: {
          ...sourceWorkflow,
          step: WorkflowEventType.WORKFLOW_NO_OPTIONS_FOUND,
        } as any,
      },
    });

    await this.sendMessage(conversation, message, false, true);

    // ⚠️ DO NOT clear workflow
    // Stay on same question
  }

  async stopConversation(conversationId: string) {
    return this.conversationRepository.save(conversationId, {
      status: ConversationStatus.STOPPED,
      state: ConversationState.INCOMPLETE,
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
