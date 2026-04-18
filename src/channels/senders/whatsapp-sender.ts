import { Injectable, HttpException, HttpStatus, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ChannelDomain, ChannelType, ExchangeStatus, ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { ParticipantService } from 'src/modules/conversation/services/participant.service';
import { ChannelService } from '../services/channel.service';

interface WhatsAppSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: {
    input: string;
    wa_id: string;
  }[];
  messages: {
    id: string; // this is the wamid
    message_status?: string;
  }[];
}


type ParsedControl = {
  text: string;
  options: { id: string; title: string }[];
};

interface WhatsAppTemplateParams {
  to: string; // recipient phone number in international format
  templateName: string; // name of the template in WhatsApp
  languageCode: string; // language code, e.g. "en_US"
  components?: any[]; // optional template components (header, body variables)
  accessToken: string; // WhatsApp Cloud API token
  phoneNumberId: string; // your WhatsApp Business phone number ID
}


@Injectable()
export class WhatsappSender implements ChannelSender, OnModuleInit {
  private readonly logger = new Logger(WhatsappSender.name);
  private channel: ChannelDomain;
  private readonly pseudoParticipant: ParticipantDomain;

  constructor(
    private readonly configService: ConfigService,
    private readonly exchangeService: ExchangeService,
    private readonly channelService: ChannelService,
    private readonly participantService: ParticipantService
  ) { }


  async onModuleInit() {
    this.logger.log('WhatsappSender initialized');
    const channel = await this.channelService.findById(this.configService.getOrThrow<string>('CHANNEL_ID_WHATSAPP'));
    if (!channel) throw new NotFoundException(`WhatsApp channel not found`);
    this.channel = channel;
    const participant = await this.participantService.findOne(channel.pseudoParticipantId);
    if (!participant) throw new NotFoundException(`Default Participant for WhatsApp channel not found`);
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
    context: Record<string, any>,
  ): Promise<void> {
    const config = this.getConfig();
    const request = {
      messaging_product: 'whatsapp',
      to: receiver.phone,
      ...this.buildWhatsAppControl(`${message}`, context?.containsLink, +context.page),
    };
    this.logger.log(`Sending WhatsApp message from sender${sender} to ${receiver}`);

    try {
      const axiosResponse = await axios.post<WhatsAppSendMessageResponse>(
        config.messagesUrl, request,
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const response = axiosResponse?.data;
      const messageId = response?.messages?.[0]?.id;
      this.logger.log(`Message sent successfully`, {
        sender,
        receiver,
        messageId,
      });
      const receiverId =  
      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: ChannelType.WHATSAPP,
        senderId: sender.id!,
        receiverId: receiver.id!,
        message,
        conversationId: context?.conversationId,
        questionnaireCode: context?.questionnaireCode,
        metadata: context,
        messageId,
        rawPayload: {
          provider: 'MetaWhatsApp',
          request,
          response
        },
      });
    } catch (error: any) {
      const err = error?.response?.data || error.message;
      this.logger.error(`Failed to send WhatsApp message`, err, {
        receiver,
      });
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
    payload: SendMediaPayload,
  ): Promise<void> {
    const config = this.getConfig();
    this.logger.log(`Preparing to send media to ${receiver} from ${sender}`);

    const mediaId =
      payload.file && !payload.fileUrl
        ? await this.uploadMedia(payload.file)
        : undefined;

    if (!mediaId && !payload.fileUrl) {
      this.logger.warn(`No media provided for ${receiver} from ${sender}`);

      throw new HttpException(
        'Provide file or fileUrl to send media',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.sendMediaMessage(sender.phone!, receiver.phone!, payload, mediaId, config);
  }

  private async uploadMedia(file: Express.Multer.File): Promise<string> {
    const config = this.getConfig();
    this.logger.log(`Uploading media: ${file.originalname}`);

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'application/octet-stream',
      });

      formData.append('messaging_product', 'whatsapp');
      formData.append('type', file.mimetype || 'application/octet-stream');
      formData.append('file', blob, file.originalname || 'upload.bin');

      const response = await axios.post(config.mediaUrl, formData, {
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      });
      this.logger.log(`Media uploaded successfully`, {
        mediaId: response.data.id,
      });
      if (!response?.data?.id) {
        throw new Error('WhatsApp media upload did not return media id');
      }

      return response.data.id;
    } catch (error: any) {
      const err = error?.response?.data || error.message;
      this.logger.error(`Media upload failed`, err);

      throw new HttpException(
        `WhatsApp media upload failed: ${JSON.stringify(err)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async sendWhatsAppTemplate({
    to,
    templateName,
    languageCode,
    components,
    accessToken,
    phoneNumberId,
  }: WhatsAppTemplateParams): Promise<WhatsAppSendMessageResponse> {
    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
    this.logger.log(`Sending template message`, {
      to,
      templateName,
    });
    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components) {
      payload.template.components = components;
    }

    try {
      const { data } = await axios.post<WhatsAppSendMessageResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      this.logger.log(`Template message sent`, {
        to,
        templateName,
      });

      return data;
    } catch (err: any) {
      console.error('Error sending WhatsApp template:', err.response?.data || err.message);
      throw err;
    }
  }

  private async sendMediaMessage(
    senderId: string,
    receiverId: string,
    payload: SendMediaPayload,
    mediaId?: string,
    config?: ReturnType<WhatsappSender['getConfig']>,
  ): Promise<void> {
    const sender = await this.participantService.findOne(senderId);
    const receiver = await this.participantService.findOne(receiverId);
    const senderConfig = config || this.getConfig();
    const type = payload.documentType || 'document';
    this.logger.log(`Sending media message`, {
      sender: sender.phone,
      type,
    });
    const supportedTypes = ['document', 'image', 'video', 'audio'];
    if (!supportedTypes.includes(type)) {
      this.logger.warn(`Unsupported media type: ${type}`);

      throw new HttpException(
        `Unsupported documentType: ${type}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const mediaObject: Record<string, string> = mediaId
      ? { id: mediaId }
      : { link: payload.fileUrl! };
    if (payload.fileName) {
      mediaObject[payload.documentType === 'image' ? 'caption' : 'filename'] = payload.fileName;
    }

    try {
      const response = await axios.post<WhatsAppSendMessageResponse>(
        senderConfig.messagesUrl,
        {
          messaging_product: 'whatsapp',
          to: receiver.phone,
          type,
          [type]: mediaObject,
        },
        {
          headers: {
            Authorization: `Bearer ${senderConfig.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const providerResponse = response?.data;
      const messageId = providerResponse?.messages?.[0]?.id;

      this.logger.log(`Media message sent`, {
        receiver: receiver.phone,
        messageId,
        type,
      });
 
      await this.exchangeService.logOutbound({
        channelId: payload.context?.channelId,
        channelType: ChannelType.WHATSAPP,
        senderId: sender.id,
        receiverId: receiver.id,
        message: `[media:${type}]`,
        conversationId: payload.context?.conversationId,
        questionnaireCode: payload.context?.questionnaireCode,
        metadata: payload.context,
        messageId,
        rawPayload: {
          provider: 'MetaWhatsApp',
          providerResponse: response.data,
          documentType: type,
          mediaId,
          fileUrl: payload.fileUrl,
          fileName: payload.fileName,
        },
      });
    } catch (error: any) {
      const err = error?.response?.data || error.message;
      await this.exchangeService.logOutbound({
        channelId: payload.context?.channelId,
        channelType: 'WHATSAPP',
        senderId: sender.id,
        receiverId: receiver.id,
        message: `[media:${type}]`,
        messageId: 'unknown',
        conversationId: payload.context?.conversationId,
        questionnaireCode: payload.context?.questionnaireCode,
        metadata: payload.context,
        rawPayload: {
          provider: 'MetaWhatsApp',
          error: err,
          documentType: type,
          mediaId,
          fileUrl: payload.fileUrl,
          fileName: payload.fileName,
        },
        status: ExchangeStatus.FAILED,
      });
      throw new HttpException(
        `WhatsApp media send failed: ${JSON.stringify(err)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }


  private parseControlString(input: string): ParsedControl {
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);

    const text = lines[0];

    const options = lines.slice(1).map((line) => {
      const parts = line.split(':').map((p) => p.trim());
      const id = parts[0] || '';
      const title = parts.length > 1 ? parts.slice(1).join(':') : '';

      return {
        id,
        title: title ? title.substring(0, 23) : '',
      };
    });

    return { text, options };
  }

  private buildWhatsAppControl(input: string, containsLink: boolean = false, page: number = 0) {
    const parsed = this.parseControlString(input);
    if (isNaN(page)) page = 0;
    if (!parsed.options.length) {
      return {
        type: "text",
        text: { preview_url: containsLink, body: input },
      };
    }

    // Buttons if <=3 options
    if (parsed.options.length <= 3) {
      return {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: parsed.text },
          action: {
            buttons: parsed.options.map((o) => ({
              type: "reply",
              reply: {
                id: o.id,
                title: o.title.slice(0, 20),
              },
            })),
          },
        },
      };
    }

    const { rows, page: currentPage, totalPages } = this.paginateOptions(parsed.options, page);

    return {
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: parsed.text,
        },
        action: {
          button: `Select (${currentPage + 1}/${totalPages} Lists)`,
          sections: [
            {
              title: "Options",
              rows,
            },
          ],
        },
      },
    };
  }

  

  private getConfig() {
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const token = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION') || 'v19.0';

    if (!phoneNumberId || !token) {
      this.logger.error('Missing WhatsApp configuration');

      throw new HttpException(
        'WhatsApp configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const baseUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
    return {
      token,
      messagesUrl: `${baseUrl}/messages`,
      mediaUrl: `${baseUrl}/media`,
    };
  }

  private paginateOptions(
    options: { id: string; title: string }[],
    pageInput: number,
  ) {
    const MAX_ROWS = 10;
    const FIRST_PAGE_SIZE = 9;
    const MIDDLE_PAGE_SIZE = 8;

    const total = options.length;
    if (total <= MAX_ROWS) {
      return {
        rows: options.map((o) => ({
          id: o.id,
          title: o.title.slice(0, 24),
        })),
        page: 0,
        totalPages: 1,
      };
    }

    const remainder = total - FIRST_PAGE_SIZE;
    const middlePages = Math.ceil(remainder / MIDDLE_PAGE_SIZE);
    const totalPages = 1 + middlePages;

    let page = Number(pageInput);
    if (isNaN(page) || page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;

    let start: number;
    let end: number;
    if (page === 0) {
      start = 0;
      end = FIRST_PAGE_SIZE;
    } else {
      start = FIRST_PAGE_SIZE + (page - 1) * MIDDLE_PAGE_SIZE;
      end = start + MIDDLE_PAGE_SIZE;
      if (page === totalPages - 1) {
        end = total;
      }
    }

    const pageItems = options.slice(start, end);

    const rows: any[] = [];
    const hasPrev = page > 0;
    const hasNext = page < totalPages - 1;

    if (hasPrev) {
      rows.push({
        id: `page_prev_${page - 1}`,
        title: '⬅ Previous',
      });
    }

    rows.push(
      ...pageItems.map((o) => ({
        id: o.id,
        title: o.title.slice(0, 24),
      })),
    );

    if (hasNext) {
      rows.push({
        id: `page_next_${page + 1}`,
        title: 'Next ➡',
      });
    }

    return {
      rows,
      page,
      totalPages,
    };
  }


}
