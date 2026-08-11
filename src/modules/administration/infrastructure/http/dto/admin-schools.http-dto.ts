import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class AdminSchoolsQueryDto {
  @ApiPropertyOptional({ enum: SchoolStatus })
  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;

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
