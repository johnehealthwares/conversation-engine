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
  ) { }


  formatNigerianNumber(phone): string {
    // Remove all non-numeric characters
    let cleaned = ('' + phone).replace(/\D/g, '');

    // If it starts with 0, replace it with 234
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    }
    // If it starts with 803 (10 digits), add 234
    else if (cleaned.length === 10) {
      cleaned = '234' + cleaned;
    }

    // Final check: ensures it's 13 digits total starting with 234
    return cleaned.startsWith('234') ? `+${cleaned}` : phone;
  }



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
        message: message.substring(0, 470),
        mobiles: this.formatNigerianNumber(participant.phone!),
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      const res = await axios.get(url);
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
