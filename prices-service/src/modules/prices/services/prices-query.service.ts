import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RANGE_TO_INTERVAL_SQL,
  SUPPORTED_EXCHANGES,
  SupportedExchange,
} from '../../../common/constants/prices.constants';
import { HistoryQueryDto } from '../dto/history-query.dto';

interface HistoryPointRow {
  exchange: SupportedExchange;
  symbol: string;
  price: string | number;
  timestamp: string;
}

interface LatestPointRow {
  exchange: SupportedExchange;
  symbol: string;
  price: string | number;
  timestamp: string;
}

@Injectable()
export class PricesQueryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

  async getHistory(query: HistoryQueryDto) {
    const exchanges = this.normalizeExchanges(query.exchanges);
    const interval = RANGE_TO_INTERVAL_SQL[query.range];

    const rows: HistoryPointRow[] = await this.dataSource.query(
      `
      select exchange, symbol, price, source_timestamp as timestamp
      from price_ticks
      where symbol = $1
        and exchange = any($2)
        and source_timestamp >= now() - $3::interval
      order by source_timestamp asc
      `,
      [query.symbol, exchanges, interval],
    );

    return rows.map((row) => ({
      exchange: row.exchange,
      symbol: row.symbol,
      price: Number(row.price),
      timestamp: new Date(row.timestamp).toISOString(),
    }));
  }

  async getLatest(symbol: string) {
    const rows: LatestPointRow[] = await this.dataSource.query(
      `
      select distinct on (exchange)
        exchange,
        symbol,
        price,
        source_timestamp as timestamp
      from price_ticks
      where symbol = $1
      order by exchange, source_timestamp desc
      `,
      [symbol],
    );

    return rows.map((row) => ({
      exchange: row.exchange,
      symbol: row.symbol,
      price: Number(row.price),
      timestamp: new Date(row.timestamp).toISOString(),
    }));
  }

  private normalizeExchanges(input?: string[]): SupportedExchange[] {
    if (!input?.length) {
      return [...SUPPORTED_EXCHANGES];
    }

    return input.filter((exchange): exchange is SupportedExchange =>
      SUPPORTED_EXCHANGES.includes(exchange as SupportedExchange),
    );
  }
}
