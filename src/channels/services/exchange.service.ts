import { Injectable, OnModuleInit } from '@nestjs/common';
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

type CreateExchangePayload = Partial<Exchange> & {
  channelType: string;
  direction: ExchangeDirection;
  status: ExchangeStatus;
  messageId: string;
};

@Injectable()
export class ExchangeService implements OnModuleInit {
  constructor(
    @InjectModel(Exchange.name)
    private readonly exchangeModel: Model<ExchangeDocument>,
    private readonly conversationService: ConversationService
  ) { }

  onModuleInit() {
    // Start watching the collection for changes
    const changeStream = this.exchangeModel.watch();

    changeStream.on('change', (change) => {
      if (change.operationType === 'insert' && change.operationType. direction === ExchangeDirection.INBOUND) {
        console.log('New Inquiry Received:', change.fullDocument);

      }
    });
  }

  async create(payload: CreateExchangePayload): Promise<Exchange> {
    return this.exchangeModel.create(payload);
  }

  async logOutbound(payload: {
    channelId?: string;
    channelType: string;
    recipient: string;
    message?: string;
    messageId: string;
    conversationId?: string;
    questionnaireCode?: string;
    metadata?: Record<string, any>;
    rawPayload?: Record<string, any>;
    status?: ExchangeStatus;
  }): Promise<Exchange> {
    return this.create({
      _id: new Types.ObjectId(),
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
    const exchange = await this.create({
      _id: new Types.ObjectId(),
      channelId: payload.channelId,
      channelType: payload.channelType,
      direction: ExchangeDirection.INBOUND,
      status: payload.status || ExchangeStatus.RECEIVED,
      sender: payload.sender,
      message: payload.message,
      messageId: payload.message,
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
    const options = { new: true };
    this.exchangeModel.findOneAndUpdate({ _id: exchangeId }, update, options)
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
        update.delivered = timestamp;
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

async processInbound(exchange: Exchange ) {
    const {
      channelId, recipient, message, questionnaireCode, messageId
    } = exchange;
    const response = await this.conversationService.processInboundMessageFromPhoneNumber(
      {id:channelId!} as ChannelDomain,
      recipient!,
      message,
      questionnaireCode!,
      {
        questionnaireCode,
        messageId
      },
    );
}
}
