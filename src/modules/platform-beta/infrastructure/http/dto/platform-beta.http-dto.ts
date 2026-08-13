import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BetaAccessStatus } from '@prisma/client';

export class PatchPlatformSettingsBodyDto {
  @IsOptional()
  @IsBoolean()
  betaEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  whatsappCommunityUrl?: string | null;
}

export class BetaAccessBodyDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(40)
  phone!: string;
}

export class BetaRequestsQueryDto {
  @IsOptional()
  @IsEnum(BetaAccessStatus)
  status?: BetaAccessStatus;

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

export class ReviewBetaRequestBodyDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
