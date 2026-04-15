import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RANGE_TO_INTERVAL_SQL,
  SUPPORTED_EXCHANGES,
  SupportedExchange,
} from '../../../common/constants/prices.constants';
import { HistoryQueryDto } from '../dto/history-query.dto';
import { RANGE_TO_BUCKET_SECONDS } from '../utils/price-time.util';

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
    const bucketSeconds = RANGE_TO_BUCKET_SECONDS[query.range];

    const rows: HistoryPointRow[] = await this.dataSource.query(
      `
    with scoped as (
      select
        pt.exchange,
        pt.symbol,
        pt.price,
        pt.source_timestamp,
        to_timestamp(
          floor(extract(epoch from pt.source_timestamp) / $4)::bigint * $4
        ) as bucket_timestamp
      from price_ticks pt
      where pt.symbol = $1
        and pt.exchange = any($2)
        and pt.source_timestamp >= now() - $3::interval
    ),
    latest_in_bucket as (
      select distinct on (exchange, symbol, bucket_timestamp)
        exchange,
        symbol,
        price,
        bucket_timestamp as timestamp
      from scoped
      order by exchange, symbol, bucket_timestamp, source_timestamp desc
    )
    select
      exchange,
      symbol,
      price,
      timestamp
    from latest_in_bucket
    order by timestamp asc, exchange asc
    `,
      [query.symbol, exchanges, interval, bucketSeconds],
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