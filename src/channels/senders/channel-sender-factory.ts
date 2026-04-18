import { Injectable, NotFoundException } from "@nestjs/common";
import { ChannelSender } from "./channel-sender";
import {  TestSender } from "./test-sender";
import { NigeriaBulkSmsSender } from "./sms-sender";
import { WhatsappSender } from "./whatsapp-sender";
import { ChannelType } from "../../shared/domain";
import { ChannelService } from "../services/channel.service";
import { EmailChannelSender } from "./email-channel-sender";

@Injectable()
export class ChannelSenderFactory {
  constructor(
    private testSender: TestSender,
    private smsSender: NigeriaBulkSmsSender,
    private whatsappSender: WhatsappSender,
    private emailSender: EmailChannelSender,
    private channelService: ChannelService
  ) {}

  async getSender(channelId: string): Promise<ChannelSender> {
    const channel = await this.channelService.findById(channelId);
    if(!channel) throw new NotFoundException(`Channel is not found - ${channelId}`)
    switch (channel.type) {
      case ChannelType.MOCK:
        return this.testSender;
      case ChannelType.SMS:
        return this.smsSender;
      case ChannelType.WHATSAPP:
        return this.whatsappSender;
  case ChannelType.EMAIL:
        return this.emailSender;
      default:
        throw new Error(`Unsupported channel ${channelId}, ${channel.name} , ${channel.type}`);
    }
  }
}
