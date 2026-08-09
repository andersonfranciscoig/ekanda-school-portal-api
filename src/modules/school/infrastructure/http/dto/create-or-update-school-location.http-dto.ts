import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateOrUpdateSchoolLocationHttpDto {
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

  @ApiProperty({ example: 'Luanda' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  province!: string;

  @ApiProperty({ example: 'Belas' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  municipality!: string;

  @ApiPropertyOptional({ example: 'Talatona' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'Rua 21 de Janeiro, nº 45' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Latitude (-90..90) or null',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Longitude (-180..180) or null',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}
