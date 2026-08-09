import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SchoolClassShift } from '../../../domain/school.enums';

export class CreateOrUpdateSchoolClassHttpDto {
  @ApiPropertyOptional({
    description: 'Present only on update. Absent = create.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({ example: '7.ª', minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  classLabel!: string;

  @ApiProperty({ example: 24, minimum: 0 })
  @IsInt()
  @Min(0)
  vacancies!: number;

  @ApiProperty({ enum: SchoolClassShift, example: SchoolClassShift.MORNING })
  @IsEnum(SchoolClassShift)
  shift!: SchoolClassShift;

  @ApiPropertyOptional({ example: '07h30 – 12h30', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schedule?: string;
}
