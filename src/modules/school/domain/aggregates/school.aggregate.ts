import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import {
  InvariantViolationException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';
import { SchoolStatus } from '../school.enums';
import { SchoolSlug } from '../value-objects/school-slug.vo';
import { SchoolLocation } from '../entities/school-location.entity';
import { SchoolClass } from '../entities/school-class.entity';
import { SchoolServiceOffer } from '../entities/school-service.entity';
import { SchoolPrice } from '../entities/school-price.entity';
import { SchoolGalleryItem } from '../entities/school-gallery-item.entity';
import {
  SchoolCreatedEvent,
  SchoolPublishedEvent,
  SchoolRejectedEvent,
  SchoolSubmittedForActivationEvent,
  SchoolSuspendedEvent,
  SchoolUpdatedEvent,
} from '../events/school.events';
import { InvalidSchoolDataException } from '../exceptions/school.exceptions';

export type SchoolActivationSnapshot = {
  hasLocation: boolean;
  hasActiveClass: boolean;
  hasValidSubscription: boolean;
  hasMinimumProfile: boolean;
};

export class School extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private _name: string,
    private _slug: SchoolSlug,
    private _description: string | null,
    private _status: SchoolStatus,
    private _phone: Phone | null,
    private _email: Email | null,
    private _website: string | null,
    private _logoUrl: string | null,
    private _coverImageUrl: string | null,
    private _foundedYear: number | null,
    private _approximateStudents: number | null,
    private _instagram: string | null,
    private _facebook: string | null,
    private _location: SchoolLocation | null,
    private _classes: SchoolClass[],
    private _services: SchoolServiceOffer[],
    private _prices: SchoolPrice[],
    private _gallery: SchoolGalleryItem[],
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _rejectionReason: string | null = null,
    private _reviewedAt: Date | null = null,
    private _reviewedByUserId: string | null = null,
    private _submittedForReviewAt: Date | null = null,
  ) {
    super();
  }

  static create(params: {
    id: string;
    name: string;
    slug: SchoolSlug;
    ownerUserId: string;
    description?: string | null;
    phone?: Phone | null;
    email?: Email | null;
    website?: string | null;
    logoUrl?: string | null;
    coverImageUrl?: string | null;
    foundedYear?: number | null;
    foundedAt?: Date | null;
    approximateStudents?: number | null;
    instagram?: string | null;
    facebook?: string | null;
    location?: SchoolLocation | null;
  }): School {
    const name = School.assertValidName(params.name);
    const description = School.assertValidDescription(params.description);
    const foundedYear = School.resolveFoundedYear(
      params.foundedYear,
      params.foundedAt,
    );
    School.assertValidFoundedYear(foundedYear);
    const approximateStudents = School.assertValidApproximateStudents(
      params.approximateStudents ?? null,
    );

    if (!params.slug?.value) {
      throw new InvalidSchoolDataException('School slug is required');
    }

    const now = new Date();
    const school = new School(
      params.id,
      name,
      params.slug,
      description,
      SchoolStatus.DRAFT,
      params.phone ?? null,
      params.email ?? null,
      params.website?.trim() || null,
      params.logoUrl?.trim() || null,
      params.coverImageUrl?.trim() || null,
      foundedYear,
      approximateStudents,
      School.normalizeOptionalText(params.instagram, 120),
      School.normalizeOptionalText(params.facebook, 120),
      params.location ?? null,
      [],
      [],
      [],
      [],
      now,
      now,
    );
    school.addDomainEvent(
      new SchoolCreatedEvent(params.id, params.ownerUserId, params.slug.value),
    );
    return school;
  }

  static rehydrate(params: {
    id: string;
    name: string;
    slug: SchoolSlug;
    description: string | null;
    status: SchoolStatus;
    phone: Phone | null;
    email: Email | null;
    website: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    foundedYear: number | null;
    approximateStudents: number | null;
    instagram: string | null;
    facebook: string | null;
    location: SchoolLocation | null;
    classes: SchoolClass[];
    services: SchoolServiceOffer[];
    prices: SchoolPrice[];
    gallery: SchoolGalleryItem[];
    createdAt: Date;
    updatedAt: Date;
    rejectionReason?: string | null;
    reviewedAt?: Date | null;
    reviewedByUserId?: string | null;
    submittedForReviewAt?: Date | null;
  }): School {
    return new School(
      params.id,
      params.name,
      params.slug,
      params.description,
      params.status,
      params.phone,
      params.email,
      params.website,
      params.logoUrl,
      params.coverImageUrl,
      params.foundedYear,
      params.approximateStudents,
      params.instagram,
      params.facebook,
      params.location,
      params.classes,
      params.services,
      params.prices,
      params.gallery,
      params.createdAt,
      params.updatedAt,
      params.rejectionReason ?? null,
      params.reviewedAt ?? null,
      params.reviewedByUserId ?? null,
      params.submittedForReviewAt ?? null,
    );
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get slug(): SchoolSlug {
    return this._slug;
  }

  get description(): string | null {
    return this._description;
  }

  get status(): SchoolStatus {
    return this._status;
  }

  get phone(): Phone | null {
    return this._phone;
  }

  get email(): Email | null {
    return this._email;
  }

  get website(): string | null {
    return this._website;
  }

  get logoUrl(): string | null {
    return this._logoUrl;
  }

  get coverImageUrl(): string | null {
    return this._coverImageUrl;
  }

  get foundedYear(): number | null {
    return this._foundedYear;
  }

  /** Derived from foundedYear for legacy callers. */
  get foundedAt(): Date | null {
    return this._foundedYear != null
      ? new Date(Date.UTC(this._foundedYear, 0, 1))
      : null;
  }

  get approximateStudents(): number | null {
    return this._approximateStudents;
  }

  get instagram(): string | null {
    return this._instagram;
  }

  get facebook(): string | null {
    return this._facebook;
  }

  get location(): SchoolLocation | null {
    return this._location;
  }

  get classes(): readonly SchoolClass[] {
    return this._classes;
  }

  get services(): readonly SchoolServiceOffer[] {
    return this._services;
  }

  get prices(): readonly SchoolPrice[] {
    return this._prices;
  }

  get gallery(): readonly SchoolGalleryItem[] {
    return this._gallery;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get rejectionReason(): string | null {
    return this._rejectionReason;
  }

  get reviewedAt(): Date | null {
    return this._reviewedAt;
  }

  get reviewedByUserId(): string | null {
    return this._reviewedByUserId;
  }

  get submittedForReviewAt(): Date | null {
    return this._submittedForReviewAt;
  }

  updateProfile(
    params: {
      name?: string;
      description?: string | null;
      phone?: Phone | null;
      email?: Email | null;
      website?: string | null;
      logoUrl?: string | null;
      coverImageUrl?: string | null;
      foundedYear?: number | null;
      foundedAt?: Date | null;
      approximateStudents?: number | null;
      instagram?: string | null;
      facebook?: string | null;
    },
    actorUserId?: string,
  ): void {
    if (params.name !== undefined) {
      this._name = School.assertValidName(params.name);
    }
    if (params.description !== undefined) {
      this._description = School.assertValidDescription(params.description);
    }
    if (params.phone !== undefined) this._phone = params.phone;
    if (params.email !== undefined) this._email = params.email;
    if (params.website !== undefined) {
      this._website = params.website?.trim() || null;
    }
    if (params.logoUrl !== undefined) this._logoUrl = params.logoUrl;
    if (params.coverImageUrl !== undefined) {
      this._coverImageUrl = params.coverImageUrl;
    }
    if (params.foundedYear !== undefined || params.foundedAt !== undefined) {
      const year = School.resolveFoundedYear(
        params.foundedYear,
        params.foundedAt,
      );
      School.assertValidFoundedYear(year);
      this._foundedYear = year;
    }
    if (params.approximateStudents !== undefined) {
      this._approximateStudents = School.assertValidApproximateStudents(
        params.approximateStudents,
      );
    }
    if (params.instagram !== undefined) {
      this._instagram = School.normalizeOptionalText(params.instagram, 120);
    }
    if (params.facebook !== undefined) {
      this._facebook = School.normalizeOptionalText(params.facebook, 120);
    }
    this.touch();
    if (actorUserId) {
      this.addDomainEvent(new SchoolUpdatedEvent(this._id, actorUserId));
    }
  }

  toSnapshot(): Record<string, unknown> {
    return {
      id: this._id,
      name: this._name,
      slug: this._slug.value,
      description: this._description,
      status: this._status,
      phone: this._phone?.value ?? null,
      email: this._email?.value ?? null,
      website: this._website,
      logoUrl: this._logoUrl,
      coverImageUrl: this._coverImageUrl,
      foundedYear: this._foundedYear,
      approximateStudents: this._approximateStudents,
      instagram: this._instagram,
      facebook: this._facebook,
    };
  }

  private static assertValidName(name: string): string {
    const trimmed = name?.trim() ?? '';
    if (trimmed.length < 3 || trimmed.length > 150) {
      throw new InvalidSchoolDataException(
        'School name must be between 3 and 150 characters',
      );
    }
    return trimmed;
  }

  private static assertValidDescription(
    description?: string | null,
  ): string | null {
    if (description == null || description.trim() === '') return null;
    const trimmed = description.trim();
    if (trimmed.length > 2000) {
      throw new InvalidSchoolDataException(
        'School description must be at most 2000 characters',
      );
    }
    return trimmed;
  }

  private static assertValidFoundedYear(foundedYear: number | null): void {
    if (foundedYear == null) return;
    if (!Number.isInteger(foundedYear)) {
      throw new InvalidSchoolDataException('foundedYear must be an integer');
    }
    const currentYear = new Date().getUTCFullYear();
    if (foundedYear < 1800 || foundedYear > currentYear) {
      throw new InvalidSchoolDataException(
        `foundedYear must be between 1800 and ${currentYear}`,
      );
    }
  }

  private static assertValidApproximateStudents(
    value: number | null,
  ): number | null {
    if (value == null) return null;
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidSchoolDataException(
        'approximateStudents must be a non-negative integer',
      );
    }
    return value;
  }

  private static resolveFoundedYear(
    foundedYear?: number | null,
    foundedAt?: Date | null,
  ): number | null {
    if (foundedYear !== undefined && foundedYear !== null) {
      return foundedYear;
    }
    if (foundedAt != null) {
      const date = foundedAt instanceof Date ? foundedAt : new Date(foundedAt);
      if (Number.isNaN(date.getTime())) {
        throw new InvalidSchoolDataException('Invalid foundedAt date');
      }
      return date.getUTCFullYear();
    }
    if (foundedYear === null || foundedAt === null) {
      return null;
    }
    return null;
  }

  private static normalizeOptionalText(
    value: string | null | undefined,
    maxLength: number,
  ): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxLength) {
      throw new InvalidSchoolDataException(
        `Text must be at most ${maxLength} characters`,
      );
    }
    return trimmed;
  }

  setLocation(location: SchoolLocation): void {
    this._location = location;
    this.touch();
  }

  addClass(schoolClass: SchoolClass): void {
    this._classes.push(schoolClass);
    this.touch();
  }

  addService(service: SchoolServiceOffer): void {
    this._services.push(service);
    this.touch();
  }

  addPrice(price: SchoolPrice): void {
    this._prices.push(price);
    this.touch();
  }

  addGalleryItem(item: SchoolGalleryItem): void {
    this._gallery.push(item);
    this.touch();
  }

  /**
   * Publication / activation invariants.
   * hasValidSubscription is evaluated via Domain Service / Policy (cross-context).
   */
  assertCanBePublished(snapshot: SchoolActivationSnapshot): void {
    if (!snapshot.hasMinimumProfile) {
      throw new InvariantViolationException(
        'School without minimum profile required',
      );
    }
    if (!snapshot.hasLocation) {
      throw new InvariantViolationException('School without location');
    }
    if (!snapshot.hasActiveClass) {
      throw new InvariantViolationException(
        'School needs at least one active class',
      );
    }
    if (!snapshot.hasValidSubscription) {
      throw new InvariantViolationException(
        'School needs a valid plan/subscription',
      );
    }
  }

  submitForActivation(snapshot: SchoolActivationSnapshot): void {
    this.assertCanBePublished(snapshot);
    if (
      this._status !== SchoolStatus.DRAFT &&
      this._status !== SchoolStatus.REJECTED &&
      this._status !== SchoolStatus.PENDING_PAYMENT
    ) {
      throw new InvariantViolationException(
        `Cannot submit school in state ${this._status}`,
      );
    }
    this._status = SchoolStatus.PENDING_REVIEW;
    this._rejectionReason = null;
    this._reviewedAt = null;
    this._reviewedByUserId = null;
    this._submittedForReviewAt = new Date();
    this.touch();
    this.addDomainEvent(new SchoolSubmittedForActivationEvent(this._id));
  }

  completeOnboarding(): void {
    if (this._status === SchoolStatus.PENDING_PAYMENT) {
      return;
    }
    if (this._status === SchoolStatus.DRAFT) {
      this._status = SchoolStatus.PENDING_PAYMENT;
      this.touch();
      return;
    }
  }

  /**
   * Activa o colégio após concessão do plano FREE (sem pagamento).
   * Idempotente em ACTIVE. Aceita DRAFT | PENDING_PAYMENT.
   */
  activateWithFreePlan(): void {
    if (this._status === SchoolStatus.ACTIVE) {
      return;
    }
    if (
      this._status === SchoolStatus.DRAFT ||
      this._status === SchoolStatus.PENDING_PAYMENT
    ) {
      this._status = SchoolStatus.ACTIVE;
      this.touch();
      this.addDomainEvent(new SchoolPublishedEvent(this._id));
      return;
    }
    throw new InvariantViolationException(
      `Cannot activate free plan for school in state ${this._status}`,
    );
  }

  /** Reactiva o colégio após pagamento confirmado (inclui EXPIRED). */
  activateAfterPaidSubscription(): void {
    if (
      this._status === SchoolStatus.ACTIVE ||
      this._status === SchoolStatus.PENDING_REVIEW ||
      this._status === SchoolStatus.REJECTED ||
      this._status === SchoolStatus.SUSPENDED
    ) {
      return;
    }
    if (
      this._status === SchoolStatus.DRAFT ||
      this._status === SchoolStatus.PENDING_PAYMENT ||
      this._status === SchoolStatus.EXPIRED
    ) {
      this._status = SchoolStatus.ACTIVE;
      this.touch();
      this.addDomainEvent(new SchoolPublishedEvent(this._id));
      return;
    }
    throw new InvariantViolationException(
      `Cannot activate paid subscription for school in state ${this._status}`,
    );
  }

  approveFromReview(actorUserId: string): void {
    if (this._status !== SchoolStatus.PENDING_REVIEW) {
      throw new InvariantViolationException(
        `Cannot approve school in state ${this._status}`,
      );
    }
    this._status = SchoolStatus.ACTIVE;
    this._rejectionReason = null;
    this._reviewedAt = new Date();
    this._reviewedByUserId = actorUserId;
    this.touch();
    this.addDomainEvent(new SchoolPublishedEvent(this._id));
  }

  rejectFromReview(actorUserId: string, reason: string): void {
    if (this._status !== SchoolStatus.PENDING_REVIEW) {
      throw new InvariantViolationException(
        `Cannot reject school in state ${this._status}`,
      );
    }
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      throw new InvariantViolationException(
        'Rejection reason must have at least 5 characters',
      );
    }
    this._status = SchoolStatus.REJECTED;
    this._rejectionReason = trimmed;
    this._reviewedAt = new Date();
    this._reviewedByUserId = actorUserId;
    this.touch();
    this.addDomainEvent(new SchoolRejectedEvent(this._id, trimmed));
  }

  publish(snapshot: SchoolActivationSnapshot): void {
    this.assertCanBePublished(snapshot);
    if (this._status === SchoolStatus.PENDING_REVIEW) {
      this.approveFromReview('system');
      return;
    }
    this._status = SchoolStatus.ACTIVE;
    this._rejectionReason = null;
    this.touch();
    this.addDomainEvent(new SchoolPublishedEvent(this._id));
  }

  suspend(reason?: string): void {
    if (this._status !== SchoolStatus.ACTIVE) {
      throw new InvariantViolationException(
        'Only active schools can be suspended',
      );
    }
    this._status = SchoolStatus.SUSPENDED;
    this.touch();
    this.addDomainEvent(new SchoolSuspendedEvent(this._id, reason));
  }

  reactivate(): void {
    if (this._status !== SchoolStatus.SUSPENDED) {
      throw new InvariantViolationException(
        'Only suspended schools can be reactivated',
      );
    }
    this._status = SchoolStatus.ACTIVE;
    this.touch();
  }

  expire(): void {
    this._status = SchoolStatus.EXPIRED;
    this.touch();
  }

  applyAdminStatus(params: {
    status: SchoolStatus;
    actorUserId: string;
    reason?: string | null;
  }): void {
    this._status = params.status;
    if (
      params.status === SchoolStatus.SUSPENDED ||
      params.status === SchoolStatus.REJECTED
    ) {
      this._rejectionReason = params.reason?.trim() || null;
    } else if (params.status === SchoolStatus.ACTIVE) {
      this._rejectionReason = null;
    }
    this._reviewedAt = new Date();
    this._reviewedByUserId = params.actorUserId;
    this.touch();
    if (params.status === SchoolStatus.ACTIVE) {
      this.addDomainEvent(new SchoolPublishedEvent(this._id));
    }
  }

  hasMinimumProfile(): boolean {
    return Boolean(this._name && this._slug && this._description);
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}
