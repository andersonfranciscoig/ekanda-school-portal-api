import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BetaAccessStatus, BetaTesterType } from '@prisma/client';

export class PatchPlatformSettingsBodyDto {
  @IsOptional()
  @IsBoolean()
  betaEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  whatsappCommunityUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  betaLimitGuardian?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  betaLimitSchoolOwner?: number;
}

export class BetaAccessRequestBodyDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(40)
  phone!: string;

  @IsEnum(BetaTesterType)
  testerType!: BetaTesterType;
}

export class BetaAccessVerifyBodyDto {
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
