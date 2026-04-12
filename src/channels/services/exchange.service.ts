import { BadRequestException, Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Exchange,
  ExchangeDirection,
  ExchangeDocument,
  ExchangeStatus,
} from '../schemas/exchange.schema';
import { WhatsAppWebhookDto } from '../controllers/dto/whatsapp.dto';
import { ConversationService } from '../../modules/conversation/services/conversation.service';
import { ChannelDomain } from '../../shared/domain';
import { FilterExchangeDto } from '../controllers/dto/filter-exchange.dto';
type CreateExchangePayload = Partial<Exchange> & {
  channelType: string;
  direction: ExchangeDirection;
  status: ExchangeStatus;
  messageId: string;
};

@Injectable()
export class ExchangeService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeService.name);

  constructor(
    @InjectModel(Exchange.name)
    private readonly exchangeModel: Model<Exchange>,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService
  ) { }

  onModuleInit() {
    this.logger.log('[exchange:watch] Starting Mongo change stream for exchanges.');
    const changeStream = this.exchangeModel.watch();

    changeStream.on('error', (error: any) => {
      if (error?.code === 40573) {
        this.logger.warn(
          '[exchange:watch] Change streams are unavailable on this Mongo deployment. Skipping exchange watcher.',
        );
        return;
      }

      this.logger.error('[exchange:watch] Change stream failed', error);
    });

    changeStream.on('change', ({ operationType, fullDocument, updateDescription }) => {
      let direction, id, info, status;
      if (operationType === 'insert') {
        id = fullDocument._id;
        direction = fullDocument?.direction;
        status = fullDocument.status;
        const { channelId, messageId, conversationId, questionnaireCode, sender, recipient, message } = fullDocument as Exchange;
        const party = sender ? sender : recipient;
        info = `message: (${message.substring(0, 100)}...) ${direction === ExchangeDirection.INBOUND ? 'received from ' : 'sent to '} ${party} `;
        if (direction === ExchangeDirection.INBOUND) {
          this.logger.debug(
            `[exchange:ingest] Forwarding inbound exchange messageId=${messageId} questionnaire=${questionnaireCode || 'n/a'}`,
          );
          this.conversationService.processInboundMessageFromPhoneNumber({ id: channelId! } as ChannelDomain, party!, message, questionnaireCode!, { messageId });
        }
      } else if (operationType === 'update') {
        id = 'id'
        direction = ''
        info = Object.entries(updateDescription?.updatedFields || {}).map(([key]) => `${key}`).join(', ')
      } else {
        info = ''
      }

      this.logger.log(
        `[exchange:${operationType}] ${status || 'UNKNOWN'} ${direction || 'n/a'} Exchange(${id}) :: ${info ? info.replace(/(\r\n|\n|\r)/g, ' ') : ''}`,
      );
    });
  }

  async create(payload: CreateExchangePayload): Promise<Exchange> {
    payload._id = new Types.ObjectId();
    return this.exchangeModel.create(payload);
  }

  async findAll(filter: FilterExchangeDto = {}): Promise<Exchange[]> {
    const query: Record<string, any> = {};

    if (filter.channelId) query.channelId = filter.channelId;
    if (filter.channelType) query.channelType = filter.channelType;
    if (filter.direction) query.direction = filter.direction;
    if (filter.status) query.status = filter.status;
    if (filter.conversationId) query.conversationId = filter.conversationId;
    if (filter.questionnaireCode) query.questionnaireCode = filter.questionnaireCode;
    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { messageId: regex },
        { sender: regex },
        { recipient: regex },
        { message: regex },
        { conversationId: regex },
        { questionnaireCode: regex },
      ];
    }

    return this.exchangeModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async logOutbound(payload: {
    channelId?: string;
    channelType: string;
    recipient: string;
    message: string;
    messageId: string;
    conversationId?: string;
    questionnaireCode?: string;
    metadata?: Record<string, any>;
    rawPayload?: Record<string, any>;
    status?: ExchangeStatus;
  }): Promise<Exchange> {
    const received = await this.exchangeModel.findOne({ messageId: payload.messageId })
    const answered = await this.exchangeModel.findOne({ messageId: payload.metadata?.contextId })
    if (received) {
      this.logger.warn(
        `[exchange:dedupe] Outbound exchange already exists for messageId=${payload.messageId}`,
      );
      return received;
    }
    if (answered){
      this.logger.warn(
        `[exchange:dedupe] Outbound exchange matched existing contextId=${payload.metadata?.contextId}`,
      );
      return answered;
    }
    this.logger.debug(
      `[exchange:outbound] Logging outbound messageId=${payload.messageId} recipient=${payload.recipient}`,
    );
    return this.create({
      channelId: payload.channelId,
      channelType: payload.channelType,
      direction: ExchangeDirection.OUTBOUND,
      status: payload.status || ExchangeStatus.SENT,
      recipient: payload.recipient,
      message: payload.message,
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      questionnaireCode: payload.questionnaireCode,
      metadata: payload.metadata,
      payload: payload.rawPayload,
    });
  }

  async logInbound(payload: {
    channelId?: string;
    channelType: string;
    sender: string;
    message: string;
    messageId: string;
    conversationId?: string;
    questionnaireCode?: string;
    metadata?: Record<string, any>;
    rawPayload?: Record<string, any>;
    status?: ExchangeStatus;
  }): Promise<Exchange> {
    const received = await this.exchangeModel.findOne({ messageId: payload.messageId })
    const answered = await this.exchangeModel.findOne({ messageId: payload.metadata?.contextId })
    if (received) {
      this.logger.warn(
        `[exchange:dedupe] Inbound exchange already exists for messageId=${payload.messageId}`,
      );
      return received;
    }
    if (answered){
      this.logger.warn(
        `[exchange:dedupe] Inbound exchange matched existing contextId=${payload.metadata?.contextId}`,
      );
    }
    this.logger.debug(
      `[exchange:inbound] Logging inbound messageId=${payload.messageId} sender=${payload.sender}`,
    );
    const exchange = await this.create({
      channelId: payload.channelId,
      channelType: payload.channelType,
      direction: ExchangeDirection.INBOUND,
      status: payload.status || ExchangeStatus.RECEIVED,
      sender: payload.sender,
      message: payload.message,
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      questionnaireCode: payload.questionnaireCode,
      metadata: payload.metadata,
      payload: payload.rawPayload,
    });
    return exchange;
  }

  async logResult(exchangeId: string, result: Record<string, any>) {
    const update = {
      $set: {
        result
      }
    };
    await this.exchangeModel.findByIdAndUpdate(exchangeId, update)
  }

  async updateExchangeFromWhatsappStatus(payload: WhatsAppWebhookDto) {
    const statuses = payload?.entry?.[0]?.changes?.[0]?.value?.statuses;

    if (!statuses?.length) return;

    for (const status of statuses) {
      const messageId = status.id;
      const timestamp = status.timestamp
        ? new Date(Number(status.timestamp) * 1000)
        : new Date();

      const update: Record<string, any> = {};

      switch (status.status) {
        case 'sent':
          update.sentAt = timestamp;
          break;

        case 'delivered':
          update.deliveredAt = timestamp;
          break;

        case 'read':
          update.readAt = timestamp;
          break;

        case 'failed':
          update.status = 'FAILED';
          update.result = status;
          break;
      }

      await this.exchangeModel.updateOne(
        { messageId },
        { $set: update },
      );
    }
  }

  async findExchangeByMessageId(messageId: string): Promise<Exchange | null> {
    const exchange = await this.exchangeModel.findOne({messageId}).lean()
    return exchange;
  }

  async isMostRecentOutboundExchange(exchange: Exchange): Promise<Boolean> {
    const mostRecent = await this.exchangeModel.findOne({direction:  ExchangeDirection.OUTBOUND}, {_id: -1}).sort( {createdAt: -1}).lean()
    return exchange._id.equals(mostRecent?._id);
  }

  // async processInbound(exchange: Exchange) {
  //   const {
  //     channelId, recipient, message, questionnaireCode, messageId
  //   } = exchange;
  //   this.logger.log(
  //     `[exchange:process] Routing exchange messageId=${messageId} questionnaire=${questionnaireCode || 'n/a'}`,
  //   );
  //   await this.conversationService.processInboundMessageFromPhoneNumber(
  //     { id: channelId! } as ChannelDomain,
  //     recipient!,
  //     message,
  //     questionnaireCode!,
  //     {
  //       questionnaireCode,
  //       messageId
  //     },
  //   );
  // }
}
