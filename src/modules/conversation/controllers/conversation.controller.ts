import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationService } from '../services/conversation.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
} from './dto/create-conversation.dto';
import { FilterConversationDto } from './dto/filter-conversation.dto';

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

  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation' })
  update(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.conversationService.updateConversationRecord(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete conversation' })
  remove(@Param('id') id: string) {
    return this.conversationService.removeConversationRecord(id);
  }
}
