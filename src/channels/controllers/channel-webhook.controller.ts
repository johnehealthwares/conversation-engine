import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody } from '@nestjs/swagger';
import { MockInboundDto } from './dto/mock.dto';
import { WhatsAppWebhookDto } from './dto/whatsapp.dto';
import { MockProcessor } from '../processors/mock-processor';
import { WhatsappProcessor } from '../processors/whatsapp-processor';

@Controller('webhooks')
export class ChannelWebhookController {
  private readonly logger = new Logger(ChannelWebhookController.name);

  constructor(
    private readonly mockProcessor: MockProcessor,
    private readonly whatsappProcessor: WhatsappProcessor,
    private readonly configService: ConfigService,
  ) {}

  @Get('whatsapp')
  verifyWhatsappWebhook(@Query() query: Record<string, string>) {
    this.logger.debug('[webhook:verify] Incoming WhatsApp webhook verification request.');
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_TOKEN');

    if (mode !== 'subscribe' || !challenge) {
      throw new BadRequestException('Invalid WhatsApp webhook challenge payload');
    }

    if (!expectedToken || token !== expectedToken) {
      this.logger.warn('[webhook:verify] WhatsApp webhook token validation failed.');
      throw new ForbiddenException('Invalid WhatsApp webhook token');
    }

    this.logger.log('[webhook:verify] WhatsApp webhook verified successfully.');
    return challenge;
  }

  @Post('whatsapp')
  @HttpCode(HttpStatus.OK) 
  @ApiBody({ type: WhatsAppWebhookDto })
  async whatsapp(@Body() payload: WhatsAppWebhookDto) {
    this.logger.log(
      `[webhook:ingest] WhatsApp payload received :: entries=${payload.entry?.length || 0}`,
    );
    return this.whatsappProcessor.processInbound(payload);
  }

  @Post('mock')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: MockInboundDto })
  async mock(@Body() payload: MockInboundDto) {
    this.logger.log(
      `[webhook:ingest] Mock payload received :: channel=${payload.channelId} from=${payload.senderPhone}`,
    );
    return this.mockProcessor.processInbound(payload);
  }


}
