import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class MarketplaceSearchQueryDto {
  @ApiPropertyOptional({ description: 'Texto livre (nome, bairro, município…)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'Luanda' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'Talatona' })
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional({ example: '1.ª' })
  @IsOptional()
  @IsString()
  classLabel?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tuitionMax?: number;

  @ApiPropertyOptional({
    description: 'CSV de serviços: transporte,cantina,ingles',
    example: 'transporte,ingles',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item: string) => item.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  serviceIds?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  fullDay?: boolean;

  @ApiPropertyOptional({
    enum: ['PUBLIC', 'PRIVATE', 'SEMI_PRIVATE', 'INTERNATIONAL'],
  })
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE', 'SEMI_PRIVATE', 'INTERNATIONAL'])
  teachingType?: string;

  @ApiPropertyOptional({
    enum: [
      'recommended',
      'nearest',
      'tuition_asc',
      'rating_desc',
      'services_desc',
    ],
    default: 'recommended',
  })
  @IsOptional()
  @IsIn([
    'recommended',
    'nearest',
    'tuition_asc',
    'rating_desc',
    'services_desc',
  ])
  sort?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 12, maximum: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Latitude para sort=nearest' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude para sort=nearest' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
