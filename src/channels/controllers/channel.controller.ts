import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { ChannelService } from '../services/channel.service';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';
import {
  SendChannelMessageDto,
  SendMessageByChannelPathDto,
} from './dto/send-channel-message.dto';
import {
  SendChannelMediaDto,
  SendChannelMediaFormDto,
} from './dto/send-channel-media.dto';
import { ChannelSenderFactory } from '../senders/channel-sender-factory';
import { ParticipantDomain } from '../../shared/domain';
import { FilterChannelDto } from './dto/filter-channel.dto';
import { ParticipantService } from 'src/modules/conversation/services/participant.service';

@ApiTags('Channels')
@Controller('channels')
export class ChannelController {
  private readonly logger = new Logger(ChannelController.name);

  constructor(
    private readonly channelService: ChannelService,
    private readonly participantService: ParticipantService,
    private readonly senderFactory: ChannelSenderFactory,
  ) {}

  @Post()
  create(@Body() dto: CreateChannelDto) {
    this.logger.log(`[channel:create] Creating channel type=${dto.type} name=${dto.name}`);
    return this.channelService.create(dto);
  }

  @Get()
  findAll(@Query() filter: FilterChannelDto) {
    return this.channelService.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channelService.findOne(id);
  }

  @Put(':id')
  replace(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.channelService.replace(id, dto);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.channelService.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.channelService.remove(id);
  }

  @Post('send-message')
  async sendMessage(@Body() dto: SendChannelMessageDto) {
    this.logger.log(
      `[channel:send-message] channel=${dto.channelId} recipient=${dto.email} ${dto.phone}`,
    );
    const channelService = await this.senderFactory.getSender(dto.channelId);
   const sender = channelService.getPseudoParticipant()
   const receiver  = await this.participantService.findBy(dto.phone, dto.email);
    
    await channelService.sendMessage(
      sender,
      receiver,
      dto.title,
      dto.message,
      { channelId: dto.channelId, source: 'channel_controller', containsLink: dto.previewLink },
    );

    return { success: true };
  }

  @Post(':channelId/send-message')
  async sendMessageByChannelPath(
    @Param('channelId') channelId: string,
    @Body() dto: SendMessageByChannelPathDto,
  ) {
    this.logger.log(
      `[channel:send-message:path] channel=${channelId} recipient=${dto.phone} ${dto.email}`,
    );
    const channelService = await this.senderFactory.getSender(channelId);
    const receiver = await this.participantService.findBy(dto.phone, dto.email);
    await channelService.sendMessage(
      channelService.getPseudoParticipant(),
      receiver,
      dto.title,
      dto.message,
      { channelId, source: 'channel_controller', containsLink: dto.previewLink },
    );

    return { success: true };
  }

  @Post('send-media')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SendChannelMediaFormDto })
  @UseInterceptors(FileInterceptor('file'))
  async sendMedia(
    @Body() dto: SendChannelMediaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.logger.log(
      `[channel:send-media] channel=${dto.channelId} recipient=${dto.phone} file=${dto.fileName || file?.originalname || dto.fileUrl || 'n/a'}`,
    );
    const channelService = await this.senderFactory.getSender(dto.channelId);


    if (!file && !dto.fileUrl) {
      throw new BadRequestException('Provide file or fileUrl');
    }

    await channelService.sendMedia(
      channelService.getPseudoParticipant(),
      await this.participantService.findBy(dto.phone, dto.email),
      {
      documentType: dto.documentType,
      file,
      fileUrl: dto.fileUrl,
      title: dto.title,
      message: dto.message,
      fileName: dto.fileName || file?.originalname,
      context: { channelId: dto.channelId, source: 'channel_controller' },
    });

    return { success: true };
  }

}
