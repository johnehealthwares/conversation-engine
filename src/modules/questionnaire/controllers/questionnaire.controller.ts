import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuestionnaireService } from '../services/questionnaire.service';
import {
  CreateQuestionnaireDto,
  UpdateQuestionnaireDto,
} from '../controllers/dto/questionnaire.dto';
import { FilterQuestionnaireDto } from './dto/filter-questionnaire.dto';

@ApiTags('Questionnaires')
@Controller('questionnaires')
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Post()
  create(@Body() dto: CreateQuestionnaireDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() filter: FilterQuestionnaireDto) {
    return this.service.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  replace(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionnaireDto,
  ) {
    return this.service.replace(id, dto);
  }

  @Patch(':id')
  patch(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionnaireDto,
  ) {
    return this.service.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
