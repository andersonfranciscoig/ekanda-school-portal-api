import { IsEnum } from 'class-validator';
import { SchoolPublicProfileLayout } from '@prisma/client';

export class UpdatePublicProfileLayoutHttpDto {
  @IsEnum(SchoolPublicProfileLayout, {
    message: 'Layout inválido. Use CLASSIC, EDITORIAL ou CAMPUS.',
  })
  layout!: SchoolPublicProfileLayout;
}
