import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationService } from '../../modules/conversation/services/conversation.service';
import { ChannelType } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { ChannelService } from '../services/channel.service';
import { ChannelProcessor } from './channel.processor';
import { MockInboundDto } from '../controllers/dto/mock.dto';

@Injectable()
export class MockProcessor implements ChannelProcessor {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly channelService: ChannelService,
    private readonly exchangeService: ExchangeService,
  ) {}

  async processInbound(payload: MockInboundDto) {
    const { from, text, questionnaireCode, channelId } = payload;
    const messageId = payload.messageId || `mock-${Date.now()}`;

    const channel = await this.channelService.findById(channelId);
    if (!channel || channel.type !== ChannelType.MOCK) {
      throw new NotFoundException('Configured MOCK channel was not found');
    }

    await this.exchangeService.logInbound({
      channelId,
      channelType: ChannelType.MOCK,
      sender: from,
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
