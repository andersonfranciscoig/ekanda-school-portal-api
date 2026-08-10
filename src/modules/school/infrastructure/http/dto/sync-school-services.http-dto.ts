import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { SchoolServiceCatalogId } from '../../../domain/school.enums';

export class SyncSchoolServicesHttpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({
    isArray: true,
    enum: SchoolServiceCatalogId,
    example: ['transporte', 'cantina', 'biblioteca'],
    description:
      'Final set of school services. Empty array clears all. Values: transporte, cantina, biblioteca, laboratorio, campo, informatica, ingles, seguranca, enfermaria, extra',
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(SchoolServiceCatalogId, { each: true })
  serviceIds!: SchoolServiceCatalogId[];
}
