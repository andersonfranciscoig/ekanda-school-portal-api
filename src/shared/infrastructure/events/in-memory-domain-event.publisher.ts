import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../../domain/events/domain-event';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';

@Injectable()
export class InMemoryDomainEventPublisher extends DomainEventPublisher {
  private readonly logger = new Logger(InMemoryDomainEventPublisher.name);

  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(
      `[DomainEvent] ${event.eventName} aggregate=${event.aggregateId}`,
    );
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
