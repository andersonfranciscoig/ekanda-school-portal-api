import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaUnitOfWork } from './prisma-unit-of-work';
import { InMemoryDomainEventPublisher } from '../../events/in-memory-domain-event.publisher';
import { DomainEventPublisher } from '../../../domain/events/domain-event-publisher';
import { FILE_STORAGE } from '../../../application/ports/file-storage.port';
import { UNIT_OF_WORK } from '../../../application/ports/unit-of-work.port';
import { AUDIT_LOGGER } from '../../../application/ports/audit-logger.port';
import { UploadThingFileStorage } from '../../storage/uploadthing/uploadthing-file-storage';
import { PrismaAuditLogger } from './prisma-audit.logger';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: DomainEventPublisher,
      useClass: InMemoryDomainEventPublisher,
    },
    {
      provide: FILE_STORAGE,
      useClass: UploadThingFileStorage,
    },
    {
      provide: UNIT_OF_WORK,
      useClass: PrismaUnitOfWork,
    },
    {
      provide: AUDIT_LOGGER,
      useClass: PrismaAuditLogger,
    },
  ],
  exports: [
    PrismaService,
    DomainEventPublisher,
    FILE_STORAGE,
    UNIT_OF_WORK,
    AUDIT_LOGGER,
  ],
})
export class SharedInfrastructureModule {}
