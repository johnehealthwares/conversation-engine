import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ChannelDomain, ExchangeStatus, ParticipantDomain } from '../../shared/domain';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ExchangeService } from '../services/exchange.service';
import { ChannelType } from '../schemas/channel.schema';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ChannelService } from '../services/channel.service';
import { ParticipantService } from 'src/modules/conversation/services/participant.service';

@Injectable()
export class EmailChannelSender implements ChannelSender, OnModuleInit {
  private readonly logger = new Logger(EmailChannelSender.name);

  private channel: ChannelDomain;
  private pseudoParticipant: ParticipantDomain;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly exchangeService: ExchangeService,
    private readonly channelService: ChannelService,
    private readonly participantService: ParticipantService
  ) { }


  async onModuleInit() {
    this.logger.log('EmailChannelSender initialized');
    const channelId = this.configService.get<string>('CHANNEL_ID_WHATSAPP');
    if (!channelId) {
      this.logger.warn('No CHANNEL_ID_WHATSAPP configured; Email sender is disabled.');
      return;
    }

    const channel = await this.channelService.findById(channelId);
    if (!channel) {
      this.logger.warn(
        `WhatsApp channel not found (${channelId}); Email sender will remain disabled.`,
      );
      return;
    }

    this.channel = channel;
    const participant = await this.participantService.findOne(channel.pseudoParticipantId);
    if (!participant) {
      this.logger.warn(
        `Default Participant for WhatsApp channel ${channelId} not found; Email sender will remain disabled.`,
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

  isHtmlString(str: string): boolean {
    const htmlRegex = /<\/?[a-z][\s\S]*>/i;
    return htmlRegex.test(str);
  }
  async sendMessage(
    sender: ParticipantDomain,
    receiver: ParticipantDomain,
    title: string,
    message: string,
    context: Record<string, any>
  ): Promise<void> {

    const isHtml = this.isHtmlString(message);
    const request = {
      to: receiver.email,
      subject: title,
      text: !isHtml ? message : '',
      html: isHtml ? message : '',
    }
    try {
      const response = await this.mailerService.sendMail(request);

      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: ChannelType.EMAIL,
        senderId: sender.id,
        receiverId: receiver.id,
        message,
        conversationId: context?.conversationId,
        questionnaireCode: context?.questionnaireCode,
        metadata: context,
        messageId: new Types.ObjectId().toString(),//TODO: Get this from response
        rawPayload: {
          provider: 'MetaWhatsApp',
          request,
          response: response?.data
        },
      });
    } catch (error) {
      const err = error?.response?.data || error.message;
      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: ChannelType.WHATSAPP,
        senderId: sender.id,
        receiverId: receiver.id,
        message,
        messageId: 'error',
        conversationId: context?.conversationId,
        questionnaireCode: context?.questionnaireCode,
        metadata: context,
        rawPayload: {
          provider: 'MetaWhatsApp',
          request,
          error: err,
        },
        status: ExchangeStatus.FAILED,
      });
    }
  }

  async sendMedia(
    sender: ParticipantDomain,
    receiver: ParticipantDomain,
    payload: SendMediaPayload
  ): Promise<void> {
    const attachments: any[] = [];
    // Case 1: File upload
    if (payload.file) {
      attachments.push({
        filename: payload.file.originalname,
        content: payload.file.buffer,
      });
    }

    // Case 2: File URL
    if (payload.fileUrl) {
      attachments.push({
        filename: payload.fileName || 'file',
        path: payload.fileUrl, // nodemailer can fetch from URL
      });
    }

    await this.mailerService.sendMail({
      to: receiver.email,
      subject: payload.title || 'Document',
      text: `${payload.message}\nPlease find attached ${payload.documentType}`,
      attachments,
    });
  }
}