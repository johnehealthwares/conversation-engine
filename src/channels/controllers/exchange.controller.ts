import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilterExchangeDto } from './dto/filter-exchange.dto';
import { ExchangeService } from '../services/exchange.service';

@ApiTags('Exchanges')
@Controller('exchanges')
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get()
  @ApiOperation({ summary: 'List exchanges' })
  findAll(@Query() filter: FilterExchangeDto) {
    return this.exchangeService.findAll(filter);
  }
}
