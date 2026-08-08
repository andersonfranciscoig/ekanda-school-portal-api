import { DomainEvent } from '../../../../shared/domain/events/domain-event';

export class SchoolCreatedEvent extends DomainEvent {
  constructor(
    schoolId: string,
    public readonly ownerUserId: string,
    public readonly slug: string,
  ) {
    super(schoolId, 'school.created');
  }
}

export class SchoolUpdatedEvent extends DomainEvent {
  constructor(
    schoolId: string,
    public readonly actorUserId: string,
  ) {
    super(schoolId, 'school.updated');
  }
}

export class SchoolSubmittedForActivationEvent extends DomainEvent {
  constructor(schoolId: string) {
    super(schoolId, 'school.submitted_for_activation');
  }
}

export class SchoolPublishedEvent extends DomainEvent {
  constructor(schoolId: string) {
    super(schoolId, 'school.published');
  }
}

export class SchoolSuspendedEvent extends DomainEvent {
  constructor(schoolId: string, public readonly reason?: string) {
    super(schoolId, 'school.suspended');
  }
}
