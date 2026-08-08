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

/** Catalog of teaching levels offered by a school (FE contract). */
export enum EducationLevelCode {
  CRECHE = 'creche',
  PRE_ESCOLAR = 'pre_escolar',
  PRIMARIO = 'primario',
  I_CICLO = 'i_ciclo',
  II_CICLO = 'ii_ciclo',
  MEDIO = 'medio',
}

/** Catalog service IDs accepted by SyncSchoolServices (FE contract). */
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

/** Class shift labels as sent by the frontend form. */
export enum SchoolClassShiftLabel {
  MANHA = 'Manhã',
  TARDE = 'Tarde',
  NOITE = 'Noite',
  DUPLO = 'Duplo',
}

export enum GalleryItemKind {
  PHOTO = 'photo',
  VIDEO = 'video',
}

export const SCHOOL_PRICES_CURRENCY = 'AOA' as const;
