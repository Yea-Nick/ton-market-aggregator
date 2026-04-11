import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HistoryQueryDto } from '../dto/history-query.dto';
import { LatestQueryDto } from '../dto/latest-query.dto';
import { PricesQueryService } from '../services/prices-query.service';

@ApiTags('prices')
@Controller('prices')
export class PricesController {
  constructor(private readonly pricesQueryService: PricesQueryService) {}

  @Get('history')
  @ApiOkResponse({ description: 'Historical TON points for selected exchanges' })
  async getHistory(@Query() query: HistoryQueryDto) {
    const points = await this.pricesQueryService.getHistory(query);

    return {
      symbol: query.symbol,
      range: query.range,
      points,
    };
  }

  @Get('latest')
  @ApiOkResponse({ description: 'Latest TON prices per exchange' })
  async getLatest(@Query() query: LatestQueryDto) {
    const items = await this.pricesQueryService.getLatest(query.symbol);

    return {
      symbol: query.symbol,
      items,
    };
  }
}
