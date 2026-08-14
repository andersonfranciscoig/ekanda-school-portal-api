import {
  InvalidCurrencyException,
  InvalidPriceRangeException,
} from '../exceptions/school.exceptions';
import {
  EducationLevelCode,
  SCHOOL_PRICES_CURRENCY,
} from '../school.enums';

export type FeeRange = {
  min: number | null;
  max: number | null;
};

export type SchoolPriceLevelSnapshot = {
  levelId: EducationLevelCode;
  enrollmentFee: FeeRange;
  tuitionFee: FeeRange;
  transportFee: FeeRange;
  mealFee: FeeRange;
};

export type SchoolPricingSnapshot = {
  id: string;
  schoolId: string;
  levels: SchoolPriceLevelSnapshot[];
  otherFees: number | null;
  currency: typeof SCHOOL_PRICES_CURRENCY;
  feesAreFree: boolean;
};

export type FeeRangeInput = {
  min?: number | string | null;
  max?: number | string | null;
};

export type SchoolPriceLevelInput = {
  levelId: EducationLevelCode;
  enrollmentFee: FeeRangeInput;
  tuitionFee: FeeRangeInput;
  transportFee: FeeRangeInput;
  mealFee: FeeRangeInput;
};

export class SchoolPricing {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private _levels: SchoolPriceLevelSnapshot[],
    private _otherFees: number | null,
    private _currency: typeof SCHOOL_PRICES_CURRENCY,
    private _feesAreFree: boolean,
  ) {}

  static create(params: {
    id: string;
    schoolId: string;
    levels: SchoolPriceLevelInput[];
    otherFees?: number | string | null;
    currency?: string | null;
    feesAreFree?: boolean;
  }): SchoolPricing {
    const feesAreFree = Boolean(params.feesAreFree);
    const levels = feesAreFree
      ? params.levels.map((level) => SchoolPricing.freeLevel(level.levelId))
      : params.levels.map((level) => SchoolPricing.mapLevel(level));
    return new SchoolPricing(
      params.id,
      params.schoolId,
      levels,
      feesAreFree ? null : SchoolPricing.parseMoney(params.otherFees, 'otherFees'),
      SchoolPricing.assertCurrency(params.currency),
      feesAreFree,
    );
  }

  static rehydrate(params: SchoolPricingSnapshot): SchoolPricing {
    return new SchoolPricing(
      params.id,
      params.schoolId,
      params.levels,
      params.otherFees,
      params.currency,
      params.feesAreFree,
    );
  }

  update(params: {
    levels: SchoolPriceLevelInput[];
    otherFees?: number | string | null;
    currency?: string | null;
    feesAreFree?: boolean;
  }): void {
    const feesAreFree =
      params.feesAreFree !== undefined
        ? Boolean(params.feesAreFree)
        : this._feesAreFree;
    this._feesAreFree = feesAreFree;
    this._levels = feesAreFree
      ? params.levels.map((level) => SchoolPricing.freeLevel(level.levelId))
      : params.levels.map((level) => SchoolPricing.mapLevel(level));
    this._otherFees = feesAreFree
      ? null
      : SchoolPricing.parseMoney(params.otherFees, 'otherFees');
    this._currency = SchoolPricing.assertCurrency(params.currency);
  }

  belongsToSchool(schoolId: string): boolean {
    return this._schoolId === schoolId;
  }

  toSnapshot(): SchoolPricingSnapshot {
    return {
      id: this._id,
      schoolId: this._schoolId,
      levels: this._levels.map((level) => ({ ...level })),
      otherFees: this._otherFees,
      currency: this._currency,
      feesAreFree: this._feesAreFree,
    };
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get feesAreFree(): boolean {
    return this._feesAreFree;
  }

  private static freeLevel(levelId: EducationLevelCode): SchoolPriceLevelSnapshot {
    const zero = { min: 0, max: 0 };
    return {
      levelId,
      enrollmentFee: { ...zero },
      tuitionFee: { ...zero },
      transportFee: { ...zero },
      mealFee: { ...zero },
    };
  }

  private static mapLevel(
    level: SchoolPriceLevelInput,
  ): SchoolPriceLevelSnapshot {
    return {
      levelId: level.levelId,
      enrollmentFee: SchoolPricing.parseRange(
        level.enrollmentFee,
        'enrollmentFee',
      ),
      tuitionFee: SchoolPricing.parseRange(level.tuitionFee, 'tuitionFee'),
      transportFee: SchoolPricing.parseRange(
        level.transportFee,
        'transportFee',
      ),
      mealFee: SchoolPricing.parseRange(level.mealFee, 'mealFee'),
    };
  }

  private static parseRange(
    range: FeeRangeInput | undefined,
    field: string,
  ): FeeRange {
    const min = SchoolPricing.parseMoney(range?.min, `${field}.min`);
    const max = SchoolPricing.parseMoney(range?.max, `${field}.max`);

    if (min != null && max != null && min > max) {
      throw new InvalidPriceRangeException(
        `${field}: min must be less than or equal to max`,
      );
    }

    return { min, max };
  }

  private static parseMoney(
    value: number | string | null | undefined,
    field: string,
  ): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed =
      typeof value === 'number' ? value : Number(String(value).trim());

    if (!Number.isFinite(parsed)) {
      throw new InvalidPriceRangeException(`${field} must be a valid number`);
    }
    if (parsed < 0) {
      throw new InvalidPriceRangeException(
        `${field} must be a non-negative number`,
      );
    }

    return Math.round(parsed * 100) / 100;
  }

  private static assertCurrency(
    currency?: string | null,
  ): typeof SCHOOL_PRICES_CURRENCY {
    const value = (currency ?? SCHOOL_PRICES_CURRENCY).trim().toUpperCase();
    if (value !== SCHOOL_PRICES_CURRENCY) {
      throw new InvalidCurrencyException();
    }
    return SCHOOL_PRICES_CURRENCY;
  }
}
