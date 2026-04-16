import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ExchangeStatus, ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { Types } from 'mongoose';
import { Channel } from 'src/shared/domain/channel.domain';

@Injectable()
export class NigeriaBulkSmsSender implements ChannelSender {
  private readonly baseUrl =
    'https://portal.nigeriabulksms.com/api/';

  private channel: Channel;

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
    sender: ParticipantDomain,
    receiver: ParticipantDomain,
    title: string,
    message: string,
    context: Record<string, any> = {},
  ): Promise<void> {
    try {
      const username = this.configService.get<string>('BULKSMS_USERNAME') || '';
      const password = this.configService.get<string>('BULKSMS_PASSWORD') || '';
      const senderName = this.configService.get<string>('BULKSMS_SENDER') || 'App';

      if (!username || !password) {
        throw new Error('BulkSMS credentials are not configured');
      }

      const params = new URLSearchParams({
        username,
        password,
        senderName,
        message: (`*${title || ''}*: ${message}`).substring(0, 470),
        mobiles: this.formatNigerianNumber(receiver.phone),
      });

      const url = `${this.baseUrl}?${params.toString()}`;
      const res = await axios.get(url);
      if (res.data && res.data.status !== 200) {
        throw new Error(JSON.stringify(res.data));
      }

      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: 'SMS',
        senderId: sender.phone!,
        receiverId: receiver.phone!,
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
        senderId: sender.id,
        receiverId: receiver.id,
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
      throw new HttpException(
        `BulkSMS error: ${err}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async sendMedia(sender: ParticipantDomain, receiver: ParticipantDomain, payload: SendMediaPayload): Promise<void> {
    //TODO: If file, upload to cloudinary
    return this.sendMessage(sender, receiver, payload.title, `${payload.message}  Download File @ ${payload.fileUrl || payload.fileName || payload.file?.filename}`, payload.context)
  }



}
