import {
  EducationLevelCode,
  SchoolServiceCatalogId,
  SchoolClassShiftLabel,
  GalleryItemKind,
} from '../school.enums';

const EDUCATION_LEVEL_SET = new Set<string>(Object.values(EducationLevelCode));
const SERVICE_CATALOG_SET = new Set<string>(
  Object.values(SchoolServiceCatalogId),
);
const SHIFT_LABEL_SET = new Set<string>(Object.values(SchoolClassShiftLabel));
const GALLERY_KIND_SET = new Set<string>(Object.values(GalleryItemKind));

export function parseEducationLevelCode(value: string): EducationLevelCode {
  if (!EDUCATION_LEVEL_SET.has(value)) {
    throw new Error(`Invalid education level: ${value}`);
  }
  return value as EducationLevelCode;
}

export function parseSchoolServiceCatalogId(
  value: string,
): SchoolServiceCatalogId {
  if (!SERVICE_CATALOG_SET.has(value)) {
    throw new Error(`Invalid school service id: ${value}`);
  }
  return value as SchoolServiceCatalogId;
}

export function parseSchoolClassShiftLabel(
  value: string,
): SchoolClassShiftLabel {
  if (!SHIFT_LABEL_SET.has(value)) {
    throw new Error(`Invalid class shift: ${value}`);
  }
  return value as SchoolClassShiftLabel;
}

export function parseGalleryItemKind(value: string): GalleryItemKind {
  if (!GALLERY_KIND_SET.has(value)) {
    throw new Error(`Invalid gallery kind: ${value}`);
  }
  return value as GalleryItemKind;
}
