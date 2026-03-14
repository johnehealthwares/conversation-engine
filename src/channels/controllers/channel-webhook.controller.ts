import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelProcessorFactory } from '../processors/channel-processor-factory';
import { ChannelType } from '../../shared/domain';
import { WhatsAppWebhookDto } from './dto/whatsapp.dto';
import { ApiBody } from '@nestjs/swagger';
import { WhatsappProcessor } from '../processors/whatsapp-processor';

@Controller('webhooks')
export class ChannelWebhookController {
  constructor(
    private readonly whatsappProcessor: WhatsappProcessor,
    private readonly configService: ConfigService,
  ) {}

  @Get('whatsapp')
  verifyWhatsappWebhook(@Query() query: Record<string, string>) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_TOKEN');

    if (mode !== 'subscribe' || !challenge) {
      throw new BadRequestException('Invalid WhatsApp webhook challenge payload');
    }

    if (!expectedToken || token !== expectedToken) {
      throw new ForbiddenException('Invalid WhatsApp webhook token');
    }

    return challenge;
  }

  @Post('whatsapp')
  @HttpCode(HttpStatus.OK) 
  @ApiBody({ type: WhatsAppWebhookDto })
  async whatsapp(@Body() payload: WhatsAppWebhookDto) {
    return this.whatsappProcessor.processInbound(payload);
  }


}
