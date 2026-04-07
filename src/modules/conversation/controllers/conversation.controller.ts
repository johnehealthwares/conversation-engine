import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationService } from '../services/conversation.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
} from './dto/create-conversation.dto';
import { FilterConversationDto } from './dto/filter-conversation.dto';
import { ProcessConversationResponseDto } from './dto/process-conversation-response.dto';

@ApiTags('Conversations')
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a conversation' })
  create(@Body() dto: CreateConversationDto) {
    return this.conversationService.createConversationRecord(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List conversations' })
  findAll(@Query() filter: FilterConversationDto) {
    return this.conversationService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by id' })
  findOne(@Param('id') id: string) {
    return this.conversationService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace conversation' })
  replace(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.conversationService.replaceConversationRecord(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch conversation' })
  patch(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.conversationService.patchConversationRecord(id, dto);
  }

  @Post(':id/process-response')
  @ApiOperation({ summary: 'Process an answer for the current conversation question' })
  processResponse(
    @Param('id') id: string,
    @Body() dto: ProcessConversationResponseDto,
  ) {
    return this.conversationService.processResponse(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete conversation' })
  remove(@Param('id') id: string) {
    return this.conversationService.removeConversationRecord(id);
  }
}
