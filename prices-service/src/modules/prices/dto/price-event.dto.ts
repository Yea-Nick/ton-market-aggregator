import { IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';

export class PriceEventDto {
  @IsString()
  eventId!: string;

  @IsString()
  exchange!: string;

  @IsString()
  symbol!: string;

  @IsNumber()
  price!: number;

  @IsISO8601()
  sourceTimestamp!: string;

  @IsOptional()
  @IsISO8601()
  fetchedAt?: string;
}
