import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ParticipantDomain } from '../../shared/domain';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ExchangeService } from '../services/exchange.service';
import { ChannelType } from '../schemas/channel.schema';
import { ExchangeStatus } from '../schemas/exchange.schema';
import { Types } from 'mongoose';

@Injectable()
export class EmailChannelSender implements ChannelSender {
  constructor(private readonly mailerService: MailerService, private readonly exchangeService: ExchangeService) {}

  isHtmlString(str: string): boolean {
  const htmlRegex = /<\/?[a-z][\s\S]*>/i;
  return htmlRegex.test(str);
}
  async sendMessage(
    participant: ParticipantDomain,
    title: string,
    message: string,
    context: Record<string, any>
  ): Promise<void> {
    if (!participant.email) {
      throw new Error('Participant does not have an email');
    }
    const isHtml = this.isHtmlString(message);
    const request = {
      to: participant.email,
      subject: title,
      text: !isHtml ? message : '',
      html:  isHtml ? message : '',
    }
    try {
    const response = await this.mailerService.sendMail(request);

        await this.exchangeService.logOutbound({
            channelId: context?.channelId,
            channelType: ChannelType.EMAIL,
            recipient: participant.email!,
            message,
            conversationId: context?.conversationId,
            questionnaireCode: context?.questionnaireCode,
            metadata: context,
            messageId: new Types.ObjectId().toString() ,//TODO: Get this from response
            rawPayload: {
              provider: 'MetaWhatsApp',
              request,
              response: response?.data
            },
          });
    }catch(error) {
       const err = error?.response?.data || error.message;
            await this.exchangeService.logOutbound({
              channelId: context?.channelId,
              channelType: ChannelType.WHATSAPP,
              recipient: participant.email!,
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
    participant: ParticipantDomain,
    payload: SendMediaPayload
  ): Promise<void> {
    if (!participant.email) {
      throw new Error('Participant does not have an email');
    }

    const attachments:any[] = [];
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
      to: participant.email,
      subject: payload.title || 'Document',
      text: `${payload.message}\nPlease find attached ${payload.documentType}`,
      attachments,
    });
  }
}