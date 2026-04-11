import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  SUPPORTED_EXCHANGES,
  SUPPORTED_RANGES,
  SupportedExchange,
  SupportedRange,
} from 'src/common/constants/prices.constants';

export class HistoryQueryDto {
  @ApiPropertyOptional({ default: 'TONUSDT' })
  @IsOptional()
  @IsString()
  symbol = 'TONUSDT';

  @ApiPropertyOptional({ enum: SUPPORTED_RANGES, default: '1h' })
  @IsOptional()
  @IsIn(SUPPORTED_RANGES)
  range: SupportedRange = '1h';

  @ApiPropertyOptional({ description: 'Comma separated exchanges', example: 'bybit,bitget' })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    return String(value)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  })
  exchanges?: SupportedExchange[];
}
