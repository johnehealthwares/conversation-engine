import { Injectable } from "@nestjs/common";
import { ChannelType } from "../../shared/domain";
import { ChannelProcessor } from "./channel.processor";
import { MockProcessor } from "./mock-processor";
import { SmsProcessor } from "./sms-processor";
import { WhatsappProcessor } from "./whatsapp-processor";

@Injectable()
export class ChannelProcessorFactory {
  constructor(
    private mockProcessor: MockProcessor,
    private smsProcessor: SmsProcessor,
    private whatsappProcessor: WhatsappProcessor,
  ) {}

  getProcessor(channel: string): ChannelProcessor {
    switch (channel) {
      case ChannelType.MOCK:
        return this.mockProcessor;

      case ChannelType.SMS:
        return this.smsProcessor;

      case ChannelType.WHATSAPP:
        return this.whatsappProcessor;

      default:
        throw new Error(`Unsupported channel ${channel}`);
    }
  }
}
