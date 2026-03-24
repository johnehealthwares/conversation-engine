import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChannelSender } from './channel-sender';
import { ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { ExchangeStatus } from '../schemas/exchange.schema';
import { Types } from 'mongoose';

@Injectable()
export class NigeriaBulkSmsSender implements ChannelSender {
  private readonly baseUrl =
    'https://portal.nigeriabulksms.com/api/';

  constructor(
    private readonly configService: ConfigService,
    private readonly exchangeService: ExchangeService,
  ) {}

  async sendMessage(
    participant: ParticipantDomain,
    title: string,
    message: string,
    containsLink: boolean,
    context: Record<string, any> = {},
  ): Promise<void> {
    try {
      const username = this.configService.get<string>('BULKSMS_USERNAME') || '';
      const password = this.configService.get<string>('BULKSMS_PASSWORD') || '';
      const sender = this.configService.get<string>('BULKSMS_SENDER') || 'App';

      if (!username || !password) {
        throw new Error('BulkSMS credentials are not configured');
      }

      const params = new URLSearchParams({
        username,
        password,
        sender,
        message,
        mobiles: participant.phone!,
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      const res = await axios.get(url);
      console.log({res})
      if (!res.data || res.data.status !== 'OK') {
        throw new Error('SMS sending failed');
      }

      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: 'SMS',
        recipient: participant.phone!,
        message,
        messageId: new Types.ObjectId().toString(),
        conversationId: context?.conversationId,
        questionnaireCode: context?.questionnaireCode,
        metadata: context,
        rawPayload: {
          provider: 'NigeriaBulkSms',
          providerResponse: res.data,
        },
      });
    } catch (err: any) {
      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: 'SMS',
        recipient: participant.phone!,
        message,
        messageId: new Types.ObjectId().toString(),
        conversationId: context?.conversationId,
        questionnaireCode: context?.questionnaireCode,
        metadata: context,
        rawPayload: {
          provider: 'NigeriaBulkSms',
          error: err?.response?.data || err?.message,
        },
        status: ExchangeStatus.FAILED,
      });
      console.log(err)
      throw new HttpException(
        `BulkSMS error: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
