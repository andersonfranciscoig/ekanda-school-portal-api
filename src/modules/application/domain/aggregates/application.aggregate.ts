import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InvariantViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { DomainEvent } from '../../../../shared/domain/events/domain-event';

export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DOCUMENT_REQUESTED = 'DOCUMENT_REQUESTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export class ApplicationSubmittedEvent extends DomainEvent {
  constructor(applicationId: string) {
    super(applicationId, 'application.submitted');
  }
}

export class ApplicationAcceptedEvent extends DomainEvent {
  constructor(applicationId: string) {
    super(applicationId, 'application.accepted');
  }
}

export class ApplicationRejectedEvent extends DomainEvent {
  constructor(applicationId: string, public readonly reason?: string) {
    super(applicationId, 'application.rejected');
  }
}

export class ApplicationDocumentRequestedEvent extends DomainEvent {
  constructor(applicationId: string) {
    super(applicationId, 'application.document_requested');
  }
}

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.SUBMITTED]: [
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.DOCUMENT_REQUESTED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.UNDER_REVIEW]: [
    ApplicationStatus.DOCUMENT_REQUESTED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.DOCUMENT_REQUESTED]: [
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.ACCEPTED]: [],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.CANCELLED]: [],
};

/**
 * Application Aggregate (candidatura).
 * ACCEPTED não volta a SUBMITTED; REJECTED não é apagada.
 */
export class Application extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private readonly _studentId: string,
    private readonly _guardianId: string,
    private readonly _schoolClassId: string | null,
    private _requestedShift: string | null,
    private _status: ApplicationStatus,
    private _notes: string | null,
    private readonly _submittedAt: Date,
    private _reviewedAt: Date | null,
  ) {
    super();
  }

  static create(params: {
    id: string;
    schoolId: string;
    studentId: string;
    guardianId: string;
    schoolClassId?: string | null;
    requestedShift?: string | null;
    notes?: string | null;
  }): Application {
    const now = new Date();
    const app = new Application(
      params.id,
      params.schoolId,
      params.studentId,
      params.guardianId,
      params.schoolClassId ?? null,
      params.requestedShift ?? null,
      ApplicationStatus.SUBMITTED,
      params.notes ?? null,
      now,
      null,
    );
    app.addDomainEvent(new ApplicationSubmittedEvent(params.id));
    return app;
  }

  static rehydrate(params: {
    id: string;
    schoolId: string;
    studentId: string;
    guardianId: string;
    schoolClassId: string | null;
    requestedShift: string | null;
    status: ApplicationStatus;
    notes: string | null;
    submittedAt: Date;
    reviewedAt: Date | null;
  }): Application {
    return new Application(
      params.id,
      params.schoolId,
      params.studentId,
      params.guardianId,
      params.schoolClassId,
      params.requestedShift,
      params.status,
      params.notes,
      params.submittedAt,
      params.reviewedAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get studentId(): string {
    return this._studentId;
  }

  get guardianId(): string {
    return this._guardianId;
  }

  get status(): ApplicationStatus {
    return this._status;
  }

  private transitionTo(next: ApplicationStatus): void {
    const allowed = ALLOWED_TRANSITIONS[this._status] ?? [];
    if (!allowed.includes(next)) {
      throw new InvariantViolationException(
        `Transição inválida: ${this._status} → ${next}`,
      );
    }
    this._status = next;
  }

  markUnderReview(): void {
    this.transitionTo(ApplicationStatus.UNDER_REVIEW);
  }

  requestDocument(): void {
    this.transitionTo(ApplicationStatus.DOCUMENT_REQUESTED);
    this.addDomainEvent(new ApplicationDocumentRequestedEvent(this._id));
  }

  accept(): void {
    this.transitionTo(ApplicationStatus.ACCEPTED);
    this._reviewedAt = new Date();
    this.addDomainEvent(new ApplicationAcceptedEvent(this._id));
  }

  reject(reason?: string): void {
    this.transitionTo(ApplicationStatus.REJECTED);
    this._reviewedAt = new Date();
    this._notes = reason ?? this._notes;
    this.addDomainEvent(new ApplicationRejectedEvent(this._id, reason));
  }

  cancel(): void {
    this.transitionTo(ApplicationStatus.CANCELLED);
  }
}
