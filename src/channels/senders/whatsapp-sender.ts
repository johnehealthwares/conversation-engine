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
    message: string,
    context?: Record<string, any>,
  ): Promise<void> {
    const config = this.getConfig();

    try {
      const response = await axios.post<WhatsAppSendMessageResponse>(
        config.messagesUrl,
        {
          messaging_product: 'whatsapp',
          to: destination.phone,
          type: 'text',
          text: {
            body: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const providerResponse = response?.data;
      const messageId = providerResponse?.messages?.[0]?.id;

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
          providerResponse,
        },
      });
    } catch (error: any) {
      const err = error?.response?.data || error.message;
      await this.exchangeService.logOutbound({
        channelId: context?.channelId,
        channelType: 'WHATSAPP',
        recipient: destination.phone!,
        message,
        messageId: 'error',
        conversationId: context?.conversationId,
        questionnaireCode: context?.questionnaireCode,
        metadata: context,
        rawPayload: {
          provider: 'MetaWhatsApp',
          error: err,
        },
        status: ExchangeStatus.FAILED,
      });

      throw new HttpException(
        `WhatsApp send failed: ${JSON.stringify(err)}`,
        HttpStatus.BAD_GATEWAY,
      );
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

  private getConfig() {
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const token = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const apiVersion =
      this.configService.get<string>('WHATSAPP_API_VERSION') || 'v19.0';

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
