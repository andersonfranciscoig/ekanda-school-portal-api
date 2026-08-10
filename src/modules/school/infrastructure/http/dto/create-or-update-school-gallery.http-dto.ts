import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateOrUpdateSchoolGalleryHttpDto {
  @ApiPropertyOptional({
    description: 'Gallery item id belonging to the school (update / replace set).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'JPEG/PNG photos (max 10MB each)',
  })
  @IsOptional()
  photos?: unknown;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'MP4 videos (max 200MB each)',
  })
  @IsOptional()
  videos?: unknown;
}
