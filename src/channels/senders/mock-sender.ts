import { Injectable, Logger } from '@nestjs/common';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ChannelType, ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';

@Injectable()
export class MockSender implements ChannelSender {
  private readonly logger = new Logger(MockSender.name);

  constructor(private readonly exchangeService: ExchangeService) {}
  sendMedia(sender: ParticipantDomain, receiver: ParticipantDomain, payload: SendMediaPayload): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async sendMessage(
    sender: ParticipantDomain,
    receiver: ParticipantDomain,
    title: string,
    message: string,
    context: Record<string, any>,
  ): Promise<void> {
    const messageId = `mock-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.logger.log(
      `[mock:send] to=${receiver.phone || receiver.id}`,
    );
    console.log('[MOCK CHANNEL OUTBOUND]', {
      to: receiver.phone || receiver.id,
      message,
      context,
    });

    await this.exchangeService.logOutbound({
      channelId: context?.channelId,
      channelType: ChannelType.MOCK,
      sender: sender.id,
      receiver: receiver.id,
      message,
      messageId,
      conversationId: context?.conversationId,
      questionnaireCode: context?.questionnaireCode,
      metadata: context,
      rawPayload: {
        provider: 'console',
        message,
        sender,
        receiver,
        context,
      },
    });
  }
}
