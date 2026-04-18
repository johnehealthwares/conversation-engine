import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ExchangeRepository } from './repositories/exchange.repository';
import { Channel, ChannelSchema } from './schemas/channel.schema';
import { ChannelService } from './services/channel.service';
import { ChannelSenderFactory } from './senders/channel-sender-factory';
import { TestSender } from './senders/test-sender';
import { NigeriaBulkSmsSender } from './senders/sms-sender';
import { WhatsappSender } from './senders/whatsapp-sender';
import { ChannelController } from './controllers/channel.controller';
import { ChannelWebhookController } from './controllers/channel-webhook.controller';
import { ExchangeController } from './controllers/exchange.controller';
import { ChannelProcessorFactory } from './processors/channel-processor-factory';
import { MockProcessor } from './processors/mock-processor';
import { WhatsappProcessor } from './processors/whatsapp-processor';
import { SmsProcessor } from './processors/sms-processor';
import { ConversationModule } from '../modules/conversation/conversation.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailChannelSender } from './senders/email-channel-sender';
import { ExchangeService } from './services/exchange.service';
import { Exchange, ExchangeSchema } from './schemas/exchange.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    forwardRef(() => ConversationModule),
    MongooseModule.forFeature([
      { name: Exchange.name, schema: ExchangeSchema },
      { name: Channel.name, schema: ChannelSchema },
    ]),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.getOrThrow<string>('SMTP_HOST'),
          port: configService.getOrThrow<number>('SMTP_PORT'),
          secure: true, // true for 465, false for 587
          auth: {
            user: configService.getOrThrow<string>('SMTP_USER'),
            pass:  configService.getOrThrow<string>('SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: configService.getOrThrow<string>('SMTP_SENDER')
        }
      })
    }),
  ],
  controllers: [ChannelController, ChannelWebhookController, ExchangeController],
  providers: [
    ExchangeRepository,
    ExchangeService,
    ChannelService,
    ChannelSenderFactory,
    TestSender,
    NigeriaBulkSmsSender,
    WhatsappSender,
    ChannelProcessorFactory,
    MockProcessor,
    WhatsappProcessor,
    SmsProcessor,
    EmailChannelSender,
  ],
  exports: [ExchangeService, ChannelService, ChannelSenderFactory],
})
export class ChannelsModule { }
