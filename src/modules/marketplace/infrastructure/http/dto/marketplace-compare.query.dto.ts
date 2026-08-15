import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class MarketplaceCompareQueryDto {
  @ApiProperty({
    description: 'IDs das instituições a comparar, separados por vírgula (2 ou 3)',
    example:
      '845c8984-0d71-4bee-9eb4-6347a41de776,11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @MinLength(36)
  ids!: string;

  @ApiPropertyOptional({ description: 'Orçamento máximo mensal (Kz) para contextualizar a IA' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tuitionMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: 'Latitude do utilizador (distâncias)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude do utilizador (distâncias)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
