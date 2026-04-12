import { Injectable, NotFoundException } from '@nestjs/common';
import { ChannelProcessor } from './channel.processor';
import { ConversationService } from '../../modules/conversation/services/conversation.service';
import { ChannelService } from '../services/channel.service';
import { ConfigService } from '@nestjs/config';
import { ExchangeService } from '../services/exchange.service';
import { ChannelType } from '../../shared/domain';
import { WhatsAppWebhookDto } from '../controllers/dto/whatsapp.dto';
import { Schema as MongooseSchema } from 'mongoose';
import { WhatsappSender } from '../senders/whatsapp-sender';

@Injectable()
export class WhatsappProcessor implements ChannelProcessor {
  constructor(
    private channelService: ChannelService,
    private conversationService: ConversationService,
    private configService: ConfigService,
    private exchangeService: ExchangeService,
    private whatsappSender: WhatsappSender,
  ) { }

  async processInbound(payload: WhatsAppWebhookDto) {

    const statuses = payload?.entry?.[0]?.changes?.[0]?.value?.statuses;

    if (statuses) {
      const exchange = await this.exchangeService.updateExchangeFromWhatsappStatus(payload);
      return exchange;
    }


    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const context = message?.context;
    const phone = payload?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id || 'unknown';
    let text
    if (message?.interactive?.button_reply?.id) {
      text = message?.interactive?.button_reply?.id
    } else if (message?.interactive?.list_reply?.id) {
      text = message?.interactive?.list_reply?.id
    } else {
      text = message?.text?.body || 'empty'
    }
    const messageId = message?.id || 'unknown';
    const questionnaireCode = text;


    const whatsappChannelId = this.configService.getOrThrow('CHANNEL_ID_WHATSAPP')
    const channel = await this.channelService.findById(whatsappChannelId)
    if (!channel) {
      throw new NotFoundException('Configured WhatsApp channel was not found');
    }
    // const answered = await this.exchangeService.({ messageId: payload.metadata?.context?.id })
    const nativigationRequest = text.match(/^page_rqst_(prev|next)_(\d+)$/)
    if (message?.context?.id) {
        const contextExchange = await this.exchangeService.findExchangeByMessageId(message?.context?.id)
      if (nativigationRequest) {
        const [, action, page] = nativigationRequest;
        await this.whatsappSender.sendMessage(
          { phone: contextExchange?.recipient } as any,
          'proceeedwithrecent',
          contextExchange!.message,
          { page, contextId: message.context.id },
        )
        return { message: 'returned new page' }
      }else if (contextExchange && !(await this.exchangeService.isMostRecentOutboundExchange(contextExchange))) {
        await this.whatsappSender.sendMessage(
          { phone: contextExchange?.recipient } as any,
          'proceeedwithrecent',
          "Please proceed with recent...",
          {contextId:message.context.id  },
        )
        return { message: 'returned proceed with most recent' }
      }

    }
    const exchange = await this.exchangeService.logInbound({
      channelId: channel.id,
      channelType: ChannelType.WHATSAPP,
      sender: phone,
      message: text,
      messageId,
      questionnaireCode,
      metadata: { source: 'whatsapp_webhook', contextId: context?.id },//TODO: Add other thing in contet
      rawPayload: payload,
      isNavigationRequest: nativigationRequest,
    });
    return exchange;
  }
}
