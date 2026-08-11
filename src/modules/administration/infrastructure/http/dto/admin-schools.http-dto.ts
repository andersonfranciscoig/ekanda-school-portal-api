import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolStatus as PrismaSchoolStatus } from '@prisma/client';
import { SchoolStatus } from '../../../../school/domain/school.enums';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class AdminSchoolsQueryDto {
  @ApiPropertyOptional({ enum: PrismaSchoolStatus })
  @IsOptional()
  @IsEnum(PrismaSchoolStatus)
  status?: PrismaSchoolStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

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

export class RejectSchoolBodyDto {
  @ApiProperty({ example: 'Informações do perfil incompletas ou inconsistentes.' })
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class PatchSchoolStatusBodyDto {
  @ApiProperty({ enum: SchoolStatus, example: SchoolStatus.ACTIVE })
  @IsEnum(SchoolStatus)
  status!: SchoolStatus;

  @ApiPropertyOptional({
    description: 'Obrigatório se SUSPENDED ou REJECTED (mín. 5 caracteres)',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({ example: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({ example: '2027-08-11T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
