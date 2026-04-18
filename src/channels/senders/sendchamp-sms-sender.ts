import { Injectable, HttpException, HttpStatus, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ChannelDomain, ExchangeStatus, ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { Types } from 'mongoose';
import { ParticipantService } from 'src/modules/conversation/services/participant.service';
import { ChannelService } from '../services/channel.service';
import { Channel } from 'src/shared/domain/channel.domain';

@Injectable()
export class SendChampSmsSender implements ChannelSender, OnModuleInit {
  private readonly logger = new Logger(SendChampSmsSender.name);

  private readonly baseUrl =
    'https://api.sendchamp.com/api/v1/sms/send';

  private channel: ChannelDomain;
  private pseudoParticipant: ParticipantDomain;
  private senderName: string;
  private apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly participantService: ParticipantService,
    private readonly exchangeService: ExchangeService,
    private readonly channelService: ChannelService,
  ) {

  }
  async onModuleInit() {
    this.logger.log('SendChampSmsSender initialized');
    const channelId = this.configService.get<string>('CHANNEL_ID_WHATSAPP');
    if (!channelId) {
      this.logger.warn('No CHANNEL_ID_WHATSAPP configured; SendChamp SMS sender is disabled.');
      return;
    }

    const channel = await this.channelService.findById(channelId);
    if (!channel) {
      this.logger.warn(
        `WhatsApp channel not found (${channelId}); SendChamp SMS sender will remain disabled.`,
      );
      return;
    }

    this.channel = channel;
    const participant = await this.participantService.findOne(channel.pseudoParticipantId);
    if (!participant) {
      this.logger.warn(
        `Default Participant for WhatsApp channel ${channelId} not found; SendChamp SMS sender will remain disabled.`,
      );
      return;
    }
    this.pseudoParticipant = participant;

  }

  getChannel(): ChannelDomain {
    return this.channel;
  }


  getPseudoParticipant(): ParticipantDomain {
    return this.pseudoParticipant;
  }



  async sendMessage(
    sender: ParticipantDomain,
    receiver: ParticipantDomain,
    title: string,
    message: string,
    context: Record<string, any> = {},
  ): Promise<void> {
    try {


      const payload = {
        to: [this.participantService.formatPhoneNigeriaMobilePhone(receiver.phone!)],
        message: (`${title ? `*${title}*: ` : ''}${message}`).substring(
          0,
          1600,
        ),
        route: 'non_dnd',
        sender_name: this.senderName,
      };

      const res = await axios.post(this.baseUrl, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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
        receiverId: receiver.id!,
        senderId: sender.id,
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
        receiverId: receiver.id!,
        senderId: sender.id,
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
    sender: ParticipantDomain,
    receiver: ParticipantDomain,
    payload: SendMediaPayload,
  ): Promise<void> {
    // SendChamp SMS doesn’t support real media → fallback to link
    return this.sendMessage(
      sender,
      receiver,
      payload?.title || '',
      `${payload?.message || ''} ${payload?.fileUrl ||
      payload?.fileName ||
      payload?.file?.filename ||
      ''
      }`,
      payload?.context,
    );
  }
}



// curl --request POST  --url https://api.sendchamp.com/api/v1/sms/send  --header 'Authorization: Bearer sendchamp_live_$2a$10$USV7lgjHISLkdtjYZonZuezJE4jgIZLX3q/Y4ZKu9anzulwllqIbu'  --header 'accept: application/json'  --header 'content-type: application/json'  --data ' { "to": [ "2348022224166" ], "message": "Your appointment is scheduled", "route": "non_dnd", "sender_name": "Healthstack" } '