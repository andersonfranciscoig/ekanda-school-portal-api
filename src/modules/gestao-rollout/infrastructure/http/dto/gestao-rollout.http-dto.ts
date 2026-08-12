import { GestaoModulePhase, GestaoWaitlistStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PatchGestaoModuleBodyDto {
  @IsEnum(GestaoModulePhase)
  phase!: GestaoModulePhase;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  testBaseUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  notifyWaitlist?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyAllSchools?: boolean;
}

export class GestaoWaitlistQueryDto {
  @IsOptional()
  @IsEnum(GestaoWaitlistStatus)
  status?: GestaoWaitlistStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class JoinGestaoWaitlistBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class ReviewGestaoWaitlistBodyDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  testUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
