import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { EducationLevelCode } from '../../../domain/school.enums';

export class SyncSchoolEducationLevelsHttpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({
    isArray: true,
    enum: EducationLevelCode,
    example: ['primario', 'i_ciclo', 'ii_ciclo', 'medio'],
    description:
      'Final set of education levels. Empty array clears all levels. Values: creche, pre_escolar, primario, i_ciclo, ii_ciclo, medio',
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(EducationLevelCode, { each: true })
  levels!: EducationLevelCode[];
}
