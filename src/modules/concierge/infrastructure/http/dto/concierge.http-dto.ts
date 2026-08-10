import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ALLOWED_VISIT_TIMES } from '../../../domain/concierge.types';

export class CreateConciergeSessionBodyDto {
  @ApiPropertyOptional({
    description: 'Identificador do dispositivo (sessões anónimas)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

export class ListConciergeSessionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

export class ConciergeTurnBodyDto {
  @ApiProperty({
    example:
      'Procuro um colégio em Talatona para a 5ª classe até 50.000 Kz com transporte',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}

export class ConciergeSearchBodyDto {
  @ApiPropertyOptional({ default: 5, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  relaxIfEmpty?: boolean;
}

export class NeedsProfileDto {
  @ApiPropertyOptional({ example: 'Talatona' })
  @IsOptional()
  @IsString()
  municipio?: string;

  @ApiPropertyOptional({ example: 'Luanda' })
  @IsOptional()
  @IsString()
  provincia?: string;

  @ApiPropertyOptional({ example: '5.ª classe' })
  @IsOptional()
  @IsString()
  classe?: string;

  @ApiPropertyOptional({ example: 50000, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  precoMax?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  transporte?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  cantina?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  ingles?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  informatica?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  integral?: boolean | null;

  @ApiPropertyOptional({ example: 'Privado' })
  @IsOptional()
  @IsString()
  tipoEnsino?: string;

  @ApiPropertyOptional({ example: 'Manhã' })
  @IsOptional()
  @IsString()
  turno?: string;
}

export class PatchConciergeNeedsBodyDto {
  @ApiProperty({ type: NeedsProfileDto })
  @ValidateNested()
  @Type(() => NeedsProfileDto)
  needs!: NeedsProfileDto;

  @ApiPropertyOptional({
    default: false,
    description: 'Se true, corre ranking e inclui bloco search na resposta',
  })
  @IsOptional()
  @IsBoolean()
  runSearch?: boolean;
}

export class ScheduleConciergeVisitBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  date!: string;

  @ApiProperty({
    enum: ALLOWED_VISIT_TIMES,
    example: '10:30',
  })
  @IsIn([...ALLOWED_VISIT_TIMES])
  time!: string;

  @ApiProperty({ example: 'Ana Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: '923000000' })
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  contactPhone!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
