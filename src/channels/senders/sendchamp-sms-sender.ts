import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { ExchangeStatus } from '../schemas/exchange.schema';
import { Types } from 'mongoose';

@Injectable()
export class SendChampSmsSender implements ChannelSender {
  private readonly baseUrl =
    'https://api.sendchamp.com/api/v1/sms/send';

  constructor(
    private readonly configService: ConfigService,
    private readonly exchangeService: ExchangeService,
  ) {}

  private formatPhone(phone: string): string {
    let cleaned = ('' + phone).replace(/\D/g, '');

    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      cleaned = '234' + cleaned;
    }

    return cleaned;
  }

  async sendMessage(
    participant: ParticipantDomain,
    title: string,
    message: string,
    context: Record<string, any> = {},
  ): Promise<void> {
    try {
      const apiKey =
        this.configService.get<string>('SENDCHAMP_API_KEY') || '';
      const senderName =
        this.configService.get<string>('SENDCHAMP_SENDER') ||
        'Healthstack';

      if (!apiKey) {
        throw new Error('SendChamp API key is not configured');
      }

      const formattedPhone = this.formatPhone(participant.phone!);

      const payload = {
        to: [formattedPhone],
        message: (`${title ? `*${title}*: ` : ''}${message}`).substring(
          0,
          1600,
        ),
        route: 'non_dnd',
        sender_name: senderName,
      };

      const res = await axios.post(this.baseUrl, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (res.data?.status !== 'success') {
        throw new Error(JSON.stringify(res.data));
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
          provider: 'SendChamp',
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
          provider: 'SendChamp',
          error: err?.response?.data || err?.message,
        },
        status: ExchangeStatus.FAILED,
      });

      throw new HttpException(
        `SendChamp error: ${err?.message || err}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async sendMedia(
    participant: ParticipantDomain,
    payload: SendMediaPayload,
  ): Promise<void> {
    // SendChamp SMS doesn’t support real media → fallback to link
    return this.sendMessage(
      participant,
      payload?.title || '',
      `${payload?.message || ''} ${
        payload?.fileUrl ||
        payload?.fileName ||
        payload?.file?.filename ||
        ''
      }`,
      payload?.context,
    );
  }
}



// curl --request POST  --url https://api.sendchamp.com/api/v1/sms/send  --header 'Authorization: Bearer sendchamp_live_$2a$10$USV7lgjHISLkdtjYZonZuezJE4jgIZLX3q/Y4ZKu9anzulwllqIbu'  --header 'accept: application/json'  --header 'content-type: application/json'  --data ' { "to": [ "2348022224166" ], "message": "Your appointment is scheduled", "route": "non_dnd", "sender_name": "Healthstack" } '