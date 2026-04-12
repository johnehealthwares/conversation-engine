import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ChannelProcessor } from './channel.processor';
import { ConversationService } from '../../modules/conversation/services/conversation.service';
import { ChannelService } from '../services/channel.service';
import { ConfigService } from '@nestjs/config';
import { ExchangeService } from '../services/exchange.service';
import { ChannelType } from '../../shared/domain';
import { WhatsAppWebhookDto } from '../controllers/dto/whatsapp.dto';
import { WhatsappSender } from '../senders/whatsapp-sender';

@Injectable()
export class WhatsappProcessor implements ChannelProcessor {
  private readonly logger = new Logger(WhatsappProcessor.name);

  constructor(
    private channelService: ChannelService,
    private conversationService: ConversationService,
    private configService: ConfigService,
    private exchangeService: ExchangeService,
    private whatsappSender: WhatsappSender,
  ) {}

  async processInbound(payload: WhatsAppWebhookDto) {
    this.logger.log('Incoming WhatsApp webhook received');
    this.logger.debug('Payload:', JSON.stringify(payload));

    try {
      const statuses = payload?.entry?.[0]?.changes?.[0]?.value?.statuses;

      if (statuses) {
        this.logger.debug('Processing WhatsApp status update', JSON.stringify(statuses));
        const exchange = await this.exchangeService.updateExchangeFromWhatsappStatus(payload);
        this.logger.log('Status update processed successfully');
        return exchange;
      }

      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      const context = message?.context;
      const phone = change?.value?.contacts?.[0]?.wa_id || 'unknown';

      let text;
      if (message?.interactive?.button_reply?.id) {
        text = message?.interactive?.button_reply?.id;
      } else if (message?.interactive?.list_reply?.id) {
        text = message?.interactive?.list_reply?.id;
      } else {
        text = message?.text?.body || 'empty';
      }

      const messageId = message?.id || 'unknown';
      const questionnaireCode = text;

      this.logger.debug(`Parsed message from ${phone}: ${text}`);

      const whatsappChannelId = this.configService.getOrThrow('CHANNEL_ID_WHATSAPP');
      const channel = await this.channelService.findById(whatsappChannelId);

      if (!channel) {
        this.logger.error('Configured WhatsApp channel not found');
        throw new NotFoundException('Configured WhatsApp channel was not found');
      }

      const nativigationRequest = text.match(/^page_rqst_(prev|next)_(\d+)$/);

      if (message?.context?.id) {
        this.logger.debug(`Message has context ID: ${message.context.id}`);

        const contextExchange = await this.exchangeService.findExchangeByMessageId(
          message?.context?.id,
        );

        if (nativigationRequest) {
          const [, action, page] = nativigationRequest;

          this.logger.log(
            `Navigation request detected: action=${action}, page=${page}`,
          );

          await this.whatsappSender.sendMessage(
            { phone: contextExchange?.recipient } as any,
            'proceeedwithrecent',
            contextExchange!.message,
            { page, contextId: message.context.id },
          );

          return { message: 'returned new page' };
        } else if (
          contextExchange &&
          !(await this.exchangeService.isMostRecentOutboundExchange(contextExchange))
        ) {
          this.logger.warn(
            `User attempted to respond to non-recent message. contextId=${message.context.id}`,
          );

          await this.whatsappSender.sendMessage(
            { phone: contextExchange?.recipient } as any,
            'proceeedwithrecent',
            'Please proceed with recent...',
            { contextId: message.context.id },
          );

          return { message: 'returned proceed with most recent' };
        }
      }

      this.logger.log(`Logging inbound message: ${messageId}`);

      const exchange = await this.exchangeService.logInbound({
        channelId: channel.id,
        channelType: ChannelType.WHATSAPP,
        sender: phone,
        message: text,
        messageId,
        questionnaireCode,
        metadata: { source: 'whatsapp_webhook', contextId: context?.id },
        rawPayload: payload,
        isNavigationRequest: nativigationRequest,
      });

      this.logger.log(`Inbound message logged successfully: ${messageId}`);

      return exchange;
    } catch (error) {
      this.logger.error(
        'Error processing WhatsApp inbound message',
        error.stack,
      );
      throw error;
    }
  }
}