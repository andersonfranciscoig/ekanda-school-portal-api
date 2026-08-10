import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  EducationLevelCode,
  SCHOOL_PRICES_CURRENCY,
} from '../../../domain/school.enums';

class FeeRangeHttpDto {
  @ApiPropertyOptional({ example: '40000', nullable: true })
  @IsOptional()
  min?: number | string | null;

  @ApiPropertyOptional({ example: '55000', nullable: true })
  @IsOptional()
  max?: number | string | null;
}

class SchoolPriceLevelHttpDto {
  @ApiProperty({ enum: EducationLevelCode, example: EducationLevelCode.CRECHE })
  @IsEnum(EducationLevelCode)
  levelId!: EducationLevelCode;

  @ApiProperty({ type: FeeRangeHttpDto })
  @ValidateNested()
  @Type(() => FeeRangeHttpDto)
  enrollmentFee!: FeeRangeHttpDto;

  @ApiProperty({ type: FeeRangeHttpDto })
  @ValidateNested()
  @Type(() => FeeRangeHttpDto)
  tuitionFee!: FeeRangeHttpDto;

  @ApiProperty({ type: FeeRangeHttpDto })
  @ValidateNested()
  @Type(() => FeeRangeHttpDto)
  transportFee!: FeeRangeHttpDto;

  @ApiProperty({ type: FeeRangeHttpDto })
  @ValidateNested()
  @Type(() => FeeRangeHttpDto)
  mealFee!: FeeRangeHttpDto;
}

export class CreateOrUpdateSchoolPriceHttpDto {
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

  @ApiProperty({ type: [SchoolPriceLevelHttpDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolPriceLevelHttpDto)
  @ArrayUnique((level: SchoolPriceLevelHttpDto) => level.levelId)
  levels!: SchoolPriceLevelHttpDto[];

  @ApiPropertyOptional({ example: '5000', nullable: true })
  @IsOptional()
  otherFees?: number | string | null;

  @ApiPropertyOptional({ enum: [SCHOOL_PRICES_CURRENCY], default: 'AOA' })
  @IsOptional()
  @IsString()
  @IsIn([SCHOOL_PRICES_CURRENCY])
  currency?: typeof SCHOOL_PRICES_CURRENCY;
}
