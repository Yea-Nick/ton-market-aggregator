import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LatestQueryDto {
  @ApiPropertyOptional({ default: 'TONUSDT' })
  @IsOptional()
  @IsString()
  symbol = 'TONUSDT';
}
