import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  SchoolPublicProfileLayout,
  SchoolPublicProfilePalette,
} from '@prisma/client';

const SECTION_IDS = [
  'summary',
  'about',
  'offer',
  'services',
  'pricing',
  'location',
] as const;

export class UpdatePublicProfileAppearanceHttpDto {
  @IsOptional()
  @IsEnum(SchoolPublicProfileLayout, {
    message: 'layout deve ser CLASSIC, EDITORIAL ou CAMPUS',
  })
  layout?: SchoolPublicProfileLayout;

  @IsOptional()
  @IsEnum(SchoolPublicProfilePalette, {
    message: 'palette inválida',
  })
  palette?: SchoolPublicProfilePalette;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionOrder?: string[];
}

export function normalizeSectionOrder(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const allowed = new Set<string>(SECTION_IDS);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim().toLowerCase();
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : null;
}

export { SECTION_IDS as PUBLIC_PROFILE_SECTION_IDS };
