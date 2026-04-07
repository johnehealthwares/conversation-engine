// controller/question.controller.ts

import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionService } from '../services/question.service';
import { FilterQuestionDto } from './dto/filter-question.dto';

@ApiTags('Questions')
@Controller('questions')
export class QuestionController {
  constructor(private readonly service: QuestionService) {}

  @Post()
  @ApiOperation({ summary: 'Create Question' })
  @ApiResponse({ status: 201, description: 'Question created' })
  async create(@Body() dto: CreateQuestionDto) {
    const result = await this.service.create(dto);
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Get Questions (Filterable)' })
  findAll(@Query() filter: FilterQuestionDto) {
    return this.service.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Question by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace Question' })
  replace(@Param('id') id: string, @Body() dto: any) {
    return this.service.replace(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch Question' })
  patch(@Param('id') id: string, @Body() dto: any) {
    return this.service.patch(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Question' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
