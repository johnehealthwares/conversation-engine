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
import { ParticipantService } from '../services/participant.service';
import { CreateParticipantDto, UpdateParticipantDto } from './dto/participant.dto';
import { FilterParticipantDto } from './dto/filter-participant.dto';

@ApiTags('Participants')
@Controller('participants')
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  @Post()
  @ApiOperation({ summary: 'Create a participant' })
  create(@Body() dto: CreateParticipantDto) {
    return this.participantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List or search participants' })
  findAll(@Query() filter: FilterParticipantDto) {
    return this.participantService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get participant by id' })
  findOne(@Param('id') id: string) {
    return this.participantService.findOne(id);
  }

  @Get(':id/conversations')
  @ApiOperation({ summary: 'List conversations for a participant' })
  findConversations(@Param('id') id: string) {
    return this.participantService.findConversations(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a participant record' })
  replace(@Param('id') id: string, @Body() dto: UpdateParticipantDto) {
    return this.participantService.replaceParticipant(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch a participant record' })
  patch(@Param('id') id: string, @Body() dto: UpdateParticipantDto) {
    return this.participantService.patchParticipant(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a participant' })
  remove(@Param('id') id: string) {
    return this.participantService.deleteParticipant(id);
  }
}
