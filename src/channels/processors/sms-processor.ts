import { Injectable, NotFoundException } from "@nestjs/common";
import { ChannelProcessor } from "./channel.processor";
import { ChannelService } from "../services/channel.service";
import { ExchangeService } from "../services/exchange.service";
import { ChannelType } from "../../shared/domain";
import { ParticipantService } from "src/modules/conversation/services/participant.service";

@Injectable()
export class SmsProcessor implements ChannelProcessor {
  constructor(
    private participantService: ParticipantService,
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

    const sender = await this.participantService.findByPhone(from);
    const receiver = await this.participantService.findOne(channel.pseudoParticipantId);

    await this.exchangeService.logInbound({
      channelId,
      channelType: ChannelType.SMS,
      senderId: sender.id,
      receiverId: receiver.id,
      message: text,
      messageId: '',
      questionnaireCode,
      metadata: { source: 'sms_webhook' },
      rawPayload: payload,
    });

    // return this.conversationService.processInboundMessageFromPhoneNumber(
    //   channel,
    //   from,
    //   text,
    //   questionnaireCode,
    //   {
    //     channelId,
    //     channelType: ChannelType.SMS,
    //     questionnaireCode,
    //     messageId: '',
    //   },
    // );
  }

  async fromNigeriaBulkSmsSender() {

  }
}
