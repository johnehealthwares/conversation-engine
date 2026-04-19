import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationService } from '../../modules/conversation/services/conversation.service';
import { ChannelType } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { ChannelService } from '../services/channel.service';
import { ChannelProcessor } from './channel.processor';
import { MockInboundDto } from '../controllers/dto/mock.dto';
import { ParticipantService } from 'src/modules/conversation/services/participant.service';

@Injectable()
export class MockProcessor implements ChannelProcessor {
  constructor(
    private readonly channelService: ChannelService,
    private readonly exchangeService: ExchangeService,
    private readonly participantService: ParticipantService
  ) {}

  async processInbound(payload: MockInboundDto) {
    const { senderPhone, text, questionnaireCode, channelId } = payload;
    const messageId = payload.messageId || `mock-${Date.now()}`;

    const channel = await this.channelService.findById(channelId);
    if (!channel || channel.type !== ChannelType.MOCK) {
      throw new NotFoundException('Configured MOCK channel was not found');
    }

    const sender = await this.participantService.findByPhone(senderPhone);

    await this.exchangeService.logInbound({
      channelId,
      channelType: ChannelType.MOCK,
      senderId: sender.id,
      receiverId:  channel.pseudoParticipantId,
      message: text,
      messageId,
      questionnaireCode: questionnaireCode || text,
      metadata: { source: 'mock_webhook' },
      rawPayload: payload,
    });

    // return this.conversationService.processInboundMessageFromPhoneNumber(
    //   channel,
    //   from,
    //   text,
    //   questionnaireCode || text,
    //   {
    //     channelId,
    //     channelType: ChannelType.MOCK,
    //     questionnaireCode: questionnaireCode || text,
    //     messageId,
    //   },
    // );
  }
}
