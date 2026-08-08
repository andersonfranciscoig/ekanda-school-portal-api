import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import {
  AuditLogEntry,
  AuditLogger,
} from '../../../application/ports/audit-logger.port';

@Injectable()
export class PrismaAuditLogger implements AuditLogger {
  private readonly logger = new Logger(PrismaAuditLogger.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          oldData:
            entry.oldData == null
              ? undefined
              : (entry.oldData as Prisma.InputJsonValue),
          newData:
            entry.newData == null
              ? undefined
              : (entry.newData as Prisma.InputJsonValue),
          metadata:
            entry.metadata == null
              ? undefined
              : (entry.metadata as Prisma.InputJsonValue),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
