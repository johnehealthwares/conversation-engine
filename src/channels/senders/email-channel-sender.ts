import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ParticipantDomain } from '../../shared/domain';
import { ChannelSender, SendMediaPayload } from './channel-sender';

@Injectable()
export class EmailChannelSender implements ChannelSender {
  constructor(private readonly mailerService: MailerService) {}

  async sendMessage(
    participant: ParticipantDomain,
    title: string,
    message: string,
    containsLink: boolean,
    context: Record<string, any>
  ): Promise<void> {
    if (!participant.email) {
      throw new Error('Participant does not have an email');
    }

    await this.mailerService.sendMail({
      to: participant.email,
      subject: title,
      text: message,
      html: `<p>${message}</p>`,
    });
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