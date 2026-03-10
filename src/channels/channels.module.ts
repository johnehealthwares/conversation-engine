import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exchange, ExchangeSchema } from './schemas/exchange.schema';
import { ExchangeService } from './services/exchange.service';
import { Channel, ChannelSchema } from './schemas/channel.schema';
import { ChannelService } from './services/channel.service';
import { ChannelSenderFactory } from './senders/channel-sender-factory';
import { NigeriaBulkSmsSender } from './senders/sms-sender';
import { WhatsappSender } from './senders/whatsapp-sender';
import { ChannelController } from './controllers/channel.controller';
import { ChannelWebhookController } from './controllers/channel-webhook.controller';
import { ChannelProcessorFactory } from './processors/channel-processor-factory';
import { WhatsappProcessor } from './processors/whatsapp-processor';
import { SmsProcessor } from './processors/sms-processor';
import { ConversationModule } from '../modules/conversation/conversation.module';
import { ConversationService } from '../modules/conversation/services/conversation.service';

@Module({
  imports: [
    forwardRef(() => ConversationModule),
    MongooseModule.forFeature([
      { name: Exchange.name, schema: ExchangeSchema },
      { name: Channel.name, schema: ChannelSchema },
    ]),
  ],
  controllers: [ChannelController, ChannelWebhookController],
  providers: [
    ExchangeService,
    ChannelService,
    ChannelSenderFactory,
    NigeriaBulkSmsSender,
    WhatsappSender,
    ChannelProcessorFactory,
    WhatsappProcessor,
    SmsProcessor,
    ConversationService,
  ],
  exports: [ExchangeService, ChannelService, ChannelSenderFactory],
})
export class ChannelsModule {}
