import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}

function toOptionalInt({ value }: { value: unknown }) {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? value : n;
}

export class CreateOrUpdateSchoolHttpDto {
  @ApiPropertyOptional({
    description: 'Present only on update. Absent = create.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Colégio Horizonte', minLength: 3, maxLength: 150 })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '+244900000000' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contacto@horizonte.ao' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'https://horizonte.ao' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({
    description:
      'Logo as URL string, or multipart binary under `logo` / `logoUrl`',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    description:
      'Cover as URL string, or multipart binary under `coverImage` / `coverImageUrl`',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    example: 2005,
    description: 'Year the school was founded (preferred over foundedAt).',
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1800)
  @Max(new Date().getUTCFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({
    example: '2005-03-15',
    description:
      'Foundation date (ISO 8601). Prefer foundedYear. Cannot be in the future.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  foundedAt?: Date;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(0)
  approximateStudents?: number;

  @ApiPropertyOptional({ example: '@colegiohorizonte' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  instagram?: string;

  @ApiPropertyOptional({ example: 'colegiohorizonte' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  facebook?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
