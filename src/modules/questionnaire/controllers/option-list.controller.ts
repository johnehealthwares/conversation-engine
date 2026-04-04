import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionListService } from '../services/option-list.service';
import {
  CreateOptionListDto,
  UpdateOptionListDto,
} from './dto/option-list.dto';
import { FilterOptionListDto } from './dto/filter-option-list.dto';

@ApiTags('OptionLists')
@Controller('option-lists')
export class OptionListController {
  constructor(private readonly service: OptionListService) {}

  @Post()
  create(@Body() dto: CreateOptionListDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() filter: FilterOptionListDto) {
    return this.service.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOptionListDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
