export abstract class DomainEvent {
  readonly occurredAt: Date;
  readonly eventId: string;

  constructor(
    public readonly aggregateId: string,
    public readonly eventName: string,
    eventId?: string,
    occurredAt?: Date,
  ) {
    this.eventId = eventId ?? crypto.randomUUID();
    this.occurredAt = occurredAt ?? new Date();
  }
}
