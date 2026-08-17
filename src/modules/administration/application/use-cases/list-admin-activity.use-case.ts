import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { fullName, normalizePage } from '../../../../shared/application/pagination';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';

export type ListAdminActivityInput = {
  page?: number;
  pageSize?: number;
  q?: string;
  entity?: string;
  actorId?: string;
};

const ACTION_LABELS: Record<string, string> = {
  SCHOOL_STATUS_CHANGED: 'Alterou o estado do colégio',
  SCHOOL_APPROVED: 'Aprovou o colégio',
  SCHOOL_REJECTED: 'Rejeitou o colégio',
  ADMIN_PLAN_GRANTED: 'Concedeu um plano',
  USER_CREATED: 'Criou um utilizador',
  USER_ACTIVATED: 'Activou o utilizador',
  USER_SUSPENDED: 'Desactivou o utilizador',
  PAYMENT_CONFIRMED: 'Confirmou um pagamento',
  PAYMENT_FAILED: 'Pagamento falhou',
  SUBSCRIPTION_CANCELLED: 'Cancelou a subscrição',
  SUBSCRIPTION_EXPIRED: 'Subscrição expirou',
  SCHOOL_CREATED: 'Criou o colégio',
  SCHOOL_UPDATED: 'Actualizou o colégio',
  NIF_SUBMITTED: 'Submeteu o NIF',
  NIF_VERIFIED_MANUAL: 'Validou NIF manualmente',
  NIF_DEADLINE_EXPIRED: 'Prazo NIF expirado — colégio suspenso',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING_PAYMENT: 'Pagamento pendente',
  PENDING_REVIEW: 'Em análise',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  EXPIRED: 'Expirado',
  REJECTED: 'Rejeitado',
};

@Injectable()
export class ListAdminActivityUseCase
  implements UseCase<ListAdminActivityInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListAdminActivityInput) {
    const { page, pageSize, skip } = normalizePage(
      input.page,
      input.pageSize ?? 30,
    );
    const q = input.q?.trim();
    const entity = input.entity?.trim();

    const where: Prisma.AuditLogWhereInput = {
      ...(input.actorId ? { actorUserId: input.actorId } : {}),
      ...(entity
        ? { entity: { equals: entity, mode: 'insensitive' } }
        : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' } },
              { entity: { contains: q, mode: 'insensitive' } },
              {
                actor: {
                  OR: [
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              platformRoles: { select: { role: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.present(row)),
      total,
      page,
      pageSize,
    };
  }

  private present(row: {
    id: string;
    actorUserId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    oldData: Prisma.JsonValue;
    newData: Prisma.JsonValue;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    actor: {
      id: string;
      firstName: string;
      lastName: string;
      platformRoles: Array<{ role: string }>;
    } | null;
  }) {
    const metadata = asRecord(row.metadata);
    const newData = asRecord(row.newData);
    const to = typeof metadata.to === 'string' ? metadata.to : null;
    const entityType = row.entity.toUpperCase();

    return {
      id: row.id,
      actor: row.actor
        ? {
            id: row.actor.id,
            name: fullName(row.actor.firstName, row.actor.lastName),
            type: row.actor.platformRoles.some((role) => role.role === 'EKANDA_ADMIN')
              ? 'ADMIN'
              : 'USER',
          }
        : {
            id: row.actorUserId,
            name: 'Sistema',
            type: 'SYSTEM',
          },
      action: row.action,
      actionLabel: this.actionLabel(row.action, to),
      entityType,
      entityId: row.entityId,
      entityLabel:
        (typeof metadata.entityLabel === 'string' && metadata.entityLabel) ||
        (typeof newData.name === 'string' && newData.name) ||
        null,
      metadata,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private actionLabel(action: string, to: string | null): string {
    if (action === 'SCHOOL_STATUS_CHANGED' && to) {
      return `Alterou o estado para ${STATUS_LABELS[to] ?? to}`;
    }
    return ACTION_LABELS[action] ?? action;
  }
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
