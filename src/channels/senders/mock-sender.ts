import { Injectable, Logger } from '@nestjs/common';
import { ChannelSender } from './channel-sender';
import { ChannelType, ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';

@Injectable()
export class MockSender implements ChannelSender {
  private readonly logger = new Logger(MockSender.name);

  constructor(private readonly exchangeService: ExchangeService) {}

  async sendMessage(
    destination: ParticipantDomain,
    title: string,
    message: string,
    containsLink: boolean,
    context: Record<string, any>,
  ): Promise<void> {
    const messageId = `mock-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.logger.log(
      `[mock:send] to=${destination.phone || destination.id} containsLink=${containsLink}`,
    );
    console.log('[MOCK CHANNEL OUTBOUND]', {
      to: destination.phone || destination.id,
      message,
      containsLink,
      context,
    });

    await this.exchangeService.logOutbound({
      channelId: context?.channelId,
      channelType: ChannelType.MOCK,
      recipient: destination.phone || destination.id || 'unknown',
      message,
      messageId,
      conversationId: context?.conversationId,
      questionnaireCode: context?.questionnaireCode,
      metadata: context,
      rawPayload: {
        provider: 'console',
        message,
        containsLink,
        destination,
        context,
      },
    });
  }
}
