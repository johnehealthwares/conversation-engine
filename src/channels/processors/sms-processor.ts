import { Injectable, NotFoundException } from "@nestjs/common";
import { ConversationService } from "../../modules/conversation/services/conversation.service";
import { ChannelProcessor } from "./channel.processor";
import { ChannelService } from "../services/channel.service";
import { ExchangeService } from "../services/exchange.service";
import { ChannelType } from "../../shared/domain";

@Injectable()
export class SmsProcessor implements ChannelProcessor {
  constructor(
    private conversationService: ConversationService,
    private channelService: ChannelService,
    private exchangeService: ExchangeService,
  ) {}

  async processInbound(payload: any) {
    const {
      from,
      text,
      questionnaireCode,
      channelId,
    } = payload;

    const channel = await this.channelService.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Configured SMS channel was not found');
    }

    await this.exchangeService.logInbound({
      channelId,
      channelType: ChannelType.SMS,
      sender: from,
      message: text,
      messageId: '',
      questionnaireCode,
      metadata: { source: 'sms_webhook' },
      rawPayload: payload,
    });

    return this.conversationService.processInboundMessageFromPhoneNumber(
      channel,
      from,
      text,
      questionnaireCode,
      {
        channelId,
        channelType: ChannelType.SMS,
        questionnaireCode,
        messageId: '',
      },
    );
  }

  async fromNigeriaBulkSmsSender() {

  }
}
