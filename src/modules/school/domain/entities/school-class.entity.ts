import { InvalidSchoolClassException } from '../exceptions/school.exceptions';
import { SchoolClassShift } from '../school.enums';

export type SchoolClassSnapshot = {
  id: string;
  schoolId: string;
  classLabel: string;
  vacancies: number;
  shift: SchoolClassShift;
  schedule: string | null;
  isActive: boolean;
};

export class SchoolClass {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private _classLabel: string,
    private _vacancies: number,
    private _shift: SchoolClassShift,
    private _schedule: string | null,
    private _isActive: boolean,
  ) {}

  static create(params: {
    id: string;
    schoolId: string;
    classLabel: string;
    vacancies: number;
    shift: SchoolClassShift;
    schedule?: string | null;
    isActive?: boolean;
  }): SchoolClass {
    const schoolId = params.schoolId?.trim();
    if (!schoolId) {
      throw new InvalidSchoolClassException('schoolId is required');
    }

    return new SchoolClass(
      params.id,
      schoolId,
      SchoolClass.assertValidClassLabel(params.classLabel),
      SchoolClass.assertValidVacancies(params.vacancies),
      SchoolClass.assertValidShift(params.shift),
      SchoolClass.normalizeSchedule(params.schedule),
      params.isActive ?? true,
    );
  }

  static rehydrate(params: {
    id: string;
    schoolId: string;
    classLabel: string;
    vacancies: number;
    shift: SchoolClassShift;
    schedule: string | null;
    isActive: boolean;
  }): SchoolClass {
    return new SchoolClass(
      params.id,
      params.schoolId,
      params.classLabel,
      params.vacancies,
      params.shift,
      params.schedule,
      params.isActive,
    );
  }

  update(params: {
    classLabel: string;
    vacancies: number;
    shift: SchoolClassShift;
    schedule?: string | null;
  }): void {
    this._classLabel = SchoolClass.assertValidClassLabel(params.classLabel);
    this._vacancies = SchoolClass.assertValidVacancies(params.vacancies);
    this._shift = SchoolClass.assertValidShift(params.shift);
    this._schedule = SchoolClass.normalizeSchedule(params.schedule);
  }

  belongsToSchool(schoolId: string): boolean {
    return this._schoolId === schoolId;
  }

  toSnapshot(): SchoolClassSnapshot {
    return {
      id: this._id,
      schoolId: this._schoolId,
      classLabel: this._classLabel,
      vacancies: this._vacancies,
      shift: this._shift,
      schedule: this._schedule,
      isActive: this._isActive,
    };
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get classLabel(): string {
    return this._classLabel;
  }

  /** @deprecated Prefer classLabel — kept for aggregate/mapper compatibility. */
  get name(): string {
    return this._classLabel;
  }

  get vacancies(): number {
    return this._vacancies;
  }

  get shift(): SchoolClassShift {
    return this._shift;
  }

  get schedule(): string | null {
    return this._schedule;
  }

  /** @deprecated Prefer schedule. */
  get description(): string | null {
    return this._schedule;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  private static assertValidClassLabel(value: string): string {
    if (typeof value !== 'string') {
      throw new InvalidSchoolClassException('classLabel is required');
    }
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      throw new InvalidSchoolClassException('classLabel is required');
    }
    if (trimmed.length > 80) {
      throw new InvalidSchoolClassException(
        'classLabel must be at most 80 characters',
      );
    }
    return trimmed;
  }

  private static assertValidVacancies(value: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new InvalidSchoolClassException(
        'Vacancies must be a non-negative integer',
      );
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidSchoolClassException(
        'Vacancies must be a non-negative integer',
      );
    }
    return value;
  }

  private static assertValidShift(value: SchoolClassShift): SchoolClassShift {
    const allowed = Object.values(SchoolClassShift);
    if (!allowed.includes(value)) {
      throw new InvalidSchoolClassException(
        `shift must be one of: ${allowed.join(', ')}`,
      );
    }
    return value;
  }

  private static normalizeSchedule(
    value: string | null | undefined,
  ): string | null {
    if (value == null) return null;
    if (typeof value !== 'string') {
      throw new InvalidSchoolClassException('schedule must be a string');
    }
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) return null;
    if (trimmed.length > 120) {
      throw new InvalidSchoolClassException(
        'schedule must be at most 120 characters',
      );
    }
    return trimmed;
  }
}
