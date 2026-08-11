import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const ADMIN_SUBSCRIPTION_FILTERS = [
  'PENDING',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'SUSPENDED',
  'EXPIRING_SOON',
] as const;

export type AdminSubscriptionStatusFilter =
  (typeof ADMIN_SUBSCRIPTION_FILTERS)[number];

export class AdminSubscriptionsQueryDto {
  @ApiPropertyOptional({ enum: ADMIN_SUBSCRIPTION_FILTERS })
  @IsOptional()
  @IsIn([...ADMIN_SUBSCRIPTION_FILTERS])
  status?: AdminSubscriptionStatusFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
