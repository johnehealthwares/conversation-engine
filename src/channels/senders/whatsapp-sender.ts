import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Express } from 'express';
import { ChannelSender, SendMediaPayload } from './channel-sender';
import { ChannelType, ParticipantDomain } from '../../shared/domain';
import { ExchangeService } from '../services/exchange.service';
import { ExchangeStatus } from '../schemas/exchange.schema';

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
export class WhatsappSender implements ChannelSender {
  constructor(
    private readonly configService: ConfigService,
    private readonly exchangeService: ExchangeService,
  ) {}

  async sendMessage(
    destination: ParticipantDomain,
    title: string,
    message: string,
    context: Record<string, any>,
  ): Promise<void> {
    const config = this.getConfig();
    const request = {
          messaging_product: 'whatsapp',
          to: destination.phone,
          ...this.buildWhatsAppControl(`${message}`, context?.containsLink, +context.page)
        };
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
      
      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: ChannelType.WHATSAPP,
        recipient: destination.phone!,
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
      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: ChannelType.WHATSAPP,
        recipient: destination.phone!,
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
    destination: ParticipantDomain,
    payload: SendMediaPayload,
  ): Promise<void> {
    const config = this.getConfig();
    const mediaId =
      payload.file && !payload.fileUrl
        ? await this.uploadMedia(payload.file)
        : undefined;

    if (!mediaId && !payload.fileUrl) {
      throw new HttpException(
        'Provide file or fileUrl to send media',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.sendMediaMessage(destination.phone!, payload, mediaId, config);
  }

  private async uploadMedia(file: Express.Multer.File): Promise<string> {
    const config = this.getConfig();

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

      if (!response?.data?.id) {
        throw new Error('WhatsApp media upload did not return media id');
      }

      return response.data.id;
    } catch (error: any) {
      const err = error?.response?.data || error.message;
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

    return data;
  } catch (err: any) {
    console.error('Error sending WhatsApp template:', err.response?.data || err.message);
    throw err;
  }
}

  private async sendMediaMessage(
    recipient: string,
    payload: SendMediaPayload,
    mediaId?: string,
    config?: ReturnType<WhatsappSender['getConfig']>,
  ): Promise<void> {
    const senderConfig = config || this.getConfig();
    const type = payload.documentType || 'document';
    const supportedTypes = ['document', 'image', 'video', 'audio'];
    if (!supportedTypes.includes(type)) {
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
          to: recipient,
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


      await this.exchangeService.logOutbound({
        channelId: payload.context?.channelId,
        channelType: ChannelType.WEBCHAT,
        recipient,
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
        recipient,
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
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);

  const text = lines[0];

  const options = lines.slice(1).map(line => {
    const [id, title] = line.split(':').map(p => p.trim());

    return {
      id,
      title: title.substring(0, 23)
    };
  });

  return { text, options };
}

private buildWhatsAppControl(input: string, containsLink: boolean = false, page: number = 0) {
  const parsed = this.parseControlString(input);
  if(isNaN(page))page = 0;
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

  const options = parsed.options;
  const totalOptions = options.length;

  // Determine total pages
  let pageSizeFirst = 10;
  if (totalOptions > 10) pageSizeFirst = 9; // first page leaves space for Next

  let totalPages: number;
  if (totalOptions <= 10) {
    totalPages = 1;
  } else {
    const remaining = totalOptions - 9;
    totalPages = 1 + Math.ceil(remaining / 8);
  }

  // Calculate start index for current page
  let start = 0;
  if (page === 0) start = 0;
  else start = 9 + (page - 1) * 8;

  // Determine how many options this page can show
  let pageSize = 10; // max rows
  const hasPrev = page > 0;
  const remainingOptions = totalOptions - start;

  if (page === 0) {
    pageSize = totalOptions > 10 ? 9 : remainingOptions; // first page
  } else if (page < totalPages - 1) {
    pageSize = 8; // middle pages have Prev + Next
  } else {
    pageSize = remainingOptions + (hasPrev ? 1 : 0); // last page may include Prev
    if (pageSize > 10) pageSize = 10; // safety
  }

  const pageOptions = options.slice(start, start + pageSize - (hasPrev && page < totalPages - 1 ? 1 : 0));

  // Build rows
  const rows: any[] = [];

  if (hasPrev) {
    rows.push({
      id: `page_rqst_prev_${page - 1}`,
      title: "⬅ Previous",
    });
  }

  rows.push(
    ...pageOptions.map((o) => ({
      id: o.id,
      title: o.title.slice(0, 24),
    })),
  );

  const isLastPage = start + pageOptions.length >= totalOptions;

  if (!isLastPage) {
    rows.push({
      id: `page_rqst_next_${page + 1}`,
      title: "Next ➡",
    });
  }

  return {
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: parsed.text,
      },
      action: {
        button: `Select (${page + 1}/${totalPages} Lists)`,
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

  
}
