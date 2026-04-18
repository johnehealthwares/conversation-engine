import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { ChannelProcessor } from './channel.processor';
import { ChannelService } from '../services/channel.service';
import { ConfigService } from '@nestjs/config';
import { ExchangeService } from '../services/exchange.service';
import { ChannelDomain, ChannelType, ParticipantDomain } from '../../shared/domain';
import { WhatsAppWebhookDto } from '../controllers/dto/whatsapp.dto';
import { WhatsappSender } from '../senders/whatsapp-sender';
import { ParticipantService } from 'src/modules/conversation/services/participant.service';

@Injectable()
export class WhatsappProcessor implements ChannelProcessor , OnModuleInit{
  private readonly logger = new Logger(WhatsappProcessor.name);
  private pseudoSender: ParticipantDomain;
  private  readonly channelId: string;
  private channel: ChannelDomain;

  constructor(
    private channelService: ChannelService,
    private participantService: ParticipantService,
    private configService: ConfigService,
    private exchangeService: ExchangeService,
    private whatsappSender: WhatsappSender,
  ) {
    this.channelId = this.configService.getOrThrow('CHANNEL_ID_WHATSAPP');
  }

  async onModuleInit() {
    const channel = await this.channelService.findById(this.channelId);
    if (!channel) {
      this.logger.warn(
        `Configured WhatsApp channel was not found ${this.channelId}. WhatsApp processor will remain disabled.`,
      );
      throw new NotFoundException('Channel for Whatsapp not found')
    }

    this.channel = channel;
    const pseudoSender = await this.participantService.findOne(
      channel.pseudoParticipantId,
    );
     if (!pseudoSender) {
      this.logger.warn(
        `Configured WhatsApp channel PseudoSender was not found ${this.channel.pseudoParticipantId}. WhatsApp processor will remain disabled.`,
      );
      throw new NotFoundException('Channel for Whatsapp not found');
    }
    this.pseudoSender = pseudoSender
  }

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
      const value = change?.value;
      const metadata = value?.metadata;
      const receiverPhone = metadata?.phone_number_id || this.pseudoSender.phone!;

      const message = value.messages?.[0];
      const context = message?.context;
      const senderPhone = change?.value?.contacts?.[0]?.wa_id!;
      
      const sender = await this.participantService.findByPhone(senderPhone);
      const receiver = await this.participantService.findByPhone(receiverPhone);

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

      this.logger.debug(`Parsed message from ${sender.phone}: ${text}`);

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
            receiver, //REVERSE roles as this is an immediate reply, sender is now the receiver
            sender,
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
            receiver,
            sender,
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
        senderId: sender.id,
        receiverId: receiver.id,
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