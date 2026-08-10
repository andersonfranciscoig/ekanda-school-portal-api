import {
  DuplicateEducationLevelException,
  DuplicateSchoolServiceException,
  InvalidEducationLevelException,
  InvalidSchoolServiceException,
} from '../exceptions/school.exceptions';
import {
  EDUCATION_LEVEL_CATALOG_ORDER,
  EducationLevelCode,
  GalleryItemKind,
  SCHOOL_SERVICE_CATALOG_ORDER,
  SchoolClassShiftLabel,
  SchoolServiceCatalogId,
} from '../school.enums';

const EDUCATION_LEVEL_SET = new Set<string>(Object.values(EducationLevelCode));
const SERVICE_CATALOG_SET = new Set<string>(
  Object.values(SchoolServiceCatalogId),
);
const SHIFT_LABEL_SET = new Set<string>(Object.values(SchoolClassShiftLabel));
const GALLERY_KIND_SET = new Set<string>(Object.values(GalleryItemKind));

export function parseEducationLevelCode(value: string): EducationLevelCode {
  if (!EDUCATION_LEVEL_SET.has(value)) {
    throw new InvalidEducationLevelException(
      `Invalid education level: ${value}`,
    );
  }
  return value as EducationLevelCode;
}

export function parseEducationLevelList(
  values: string[],
): EducationLevelCode[] {
  if (!Array.isArray(values)) {
    throw new InvalidEducationLevelException('levels must be an array');
  }

  const seen = new Set<string>();
  const parsed: EducationLevelCode[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      throw new DuplicateEducationLevelException(
        `Duplicate education level: ${value}`,
      );
    }
    seen.add(value);
    parsed.push(parseEducationLevelCode(value));
  }

  return sortEducationLevels(parsed);
}

export function sortEducationLevels(
  levels: EducationLevelCode[],
): EducationLevelCode[] {
  const set = new Set(levels);
  return EDUCATION_LEVEL_CATALOG_ORDER.filter((level) => set.has(level));
}

export function parseSchoolServiceCatalogId(
  value: string,
): SchoolServiceCatalogId {
  if (!SERVICE_CATALOG_SET.has(value)) {
    throw new InvalidSchoolServiceException(
      `Invalid school service id: ${value}`,
    );
  }
  return value as SchoolServiceCatalogId;
}

export function parseSchoolServiceCatalogList(
  values: string[],
): SchoolServiceCatalogId[] {
  if (!Array.isArray(values)) {
    throw new InvalidSchoolServiceException('serviceIds must be an array');
  }

  const seen = new Set<string>();
  const parsed: SchoolServiceCatalogId[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      throw new DuplicateSchoolServiceException(
        `Duplicate school service id: ${value}`,
      );
    }
    seen.add(value);
    parsed.push(parseSchoolServiceCatalogId(value));
  }

  return sortSchoolServices(parsed);
}

export function sortSchoolServices(
  services: SchoolServiceCatalogId[],
): SchoolServiceCatalogId[] {
  const set = new Set(services);
  return SCHOOL_SERVICE_CATALOG_ORDER.filter((service) => set.has(service));
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
