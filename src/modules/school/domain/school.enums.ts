export enum SchoolStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

export enum SchoolMembershipRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
  REMOVED = 'REMOVED',
}

export enum EducationLevelCode {
  CRECHE = 'creche',
  PRE_ESCOLAR = 'pre_escolar',
  PRIMARIO = 'primario',
  I_CICLO = 'i_ciclo',
  II_CICLO = 'ii_ciclo',
  MEDIO = 'medio',
}

export const EDUCATION_LEVEL_CATALOG_ORDER: EducationLevelCode[] = [
  EducationLevelCode.CRECHE,
  EducationLevelCode.PRE_ESCOLAR,
  EducationLevelCode.PRIMARIO,
  EducationLevelCode.I_CICLO,
  EducationLevelCode.II_CICLO,
  EducationLevelCode.MEDIO,
];

export enum SchoolServiceCatalogId {
  TRANSPORTE = 'transporte',
  CANTINA = 'cantina',
  BIBLIOTECA = 'biblioteca',
  LABORATORIO = 'laboratorio',
  CAMPO = 'campo',
  INFORMATICA = 'informatica',
  INGLES = 'ingles',
  SEGURANCA = 'seguranca',
  ENFERMARIA = 'enfermaria',
  EXTRA = 'extra',
}

export const SCHOOL_SERVICE_CATALOG_ORDER: SchoolServiceCatalogId[] = [
  SchoolServiceCatalogId.TRANSPORTE,
  SchoolServiceCatalogId.CANTINA,
  SchoolServiceCatalogId.BIBLIOTECA,
  SchoolServiceCatalogId.LABORATORIO,
  SchoolServiceCatalogId.CAMPO,
  SchoolServiceCatalogId.INFORMATICA,
  SchoolServiceCatalogId.INGLES,
  SchoolServiceCatalogId.SEGURANCA,
  SchoolServiceCatalogId.ENFERMARIA,
  SchoolServiceCatalogId.EXTRA,
];

export enum SchoolClassShiftLabel {
  MANHA = 'Manhã',
  TARDE = 'Tarde',
  NOITE = 'Noite',
  DUPLO = 'Duplo',
}

export enum SchoolClassShift {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
  DOUBLE = 'DOUBLE',
}

export enum GalleryItemKind {
  PHOTO = 'photo',
  VIDEO = 'video',
}

export enum GalleryKind {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
}

export const SCHOOL_PRICES_CURRENCY = 'AOA' as const;
