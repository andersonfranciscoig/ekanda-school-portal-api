import { Injectable } from '@nestjs/common';
import {
  ConciergeMessageKind,
  ConciergePhase,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  ConciergeAccessDeniedException,
  ConciergeSessionNotFoundException,
} from '../../domain/exceptions/concierge.exceptions';
import {
  EMPTY_NEEDS,
  NeedsProfile,
  WELCOME_MESSAGE,
} from '../../domain/concierge.types';

@Injectable()
export class ConciergeSessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(params: {
    userId?: string | null;
    deviceId?: string | null;
  }) {
    const sessionId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    return this.prisma.conciergeSession.create({
      data: {
        id: sessionId,
        userId: params.userId ?? null,
        deviceId: params.deviceId ?? null,
        title: 'Nova procura',
        phase: ConciergePhase.collecting,
        needs: EMPTY_NEEDS as unknown as Prisma.InputJsonValue,
        resultIds: [],
        messages: {
          create: {
            id: messageId,
            role: 'assistant',
            kind: ConciergeMessageKind.text,
            content: WELCOME_MESSAGE,
          },
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getSessionOrThrow(sessionId: string) {
    const session = await this.prisma.conciergeSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new ConciergeSessionNotFoundException();
    return session;
  }

  assertCanAccess(
    session: { userId: string | null; deviceId: string | null },
    actor: { userId?: string | null; deviceId?: string | null },
  ) {
    if (session.userId) {
      if (!actor.userId || actor.userId !== session.userId) {
        throw new ConciergeAccessDeniedException();
      }
      return;
    }
    if (session.deviceId && actor.deviceId && session.deviceId !== actor.deviceId) {
      throw new ConciergeAccessDeniedException();
    }
  }

  async listSessions(params: {
    userId?: string | null;
    deviceId?: string | null;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.ConciergeSessionWhereInput = {};
    if (params.userId) where.userId = params.userId;
    else if (params.deviceId) where.deviceId = params.deviceId;
    else return { rows: [], total: 0 };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.conciergeSession.count({ where }),
      this.prisma.conciergeSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return { rows, total };
  }

  async deleteSession(
    sessionId: string,
    actor: { userId?: string | null; deviceId?: string | null },
  ) {
    const session = await this.getSessionOrThrow(sessionId);
    this.assertCanAccess(session, actor);
    await this.prisma.conciergeSession.delete({ where: { id: session.id } });
    return { id: session.id };
  }

  async deleteAllSessions(actor: {
    userId?: string | null;
    deviceId?: string | null;
  }) {
    const or: Prisma.ConciergeSessionWhereInput[] = [];
    if (actor.userId) or.push({ userId: actor.userId });
    if (actor.deviceId) {
      or.push({
        deviceId: actor.deviceId,
        ...(actor.userId ? { userId: null } : {}),
      });
    }
    if (!or.length) return { deletedCount: 0 };

    const result = await this.prisma.conciergeSession.deleteMany({
      where: { OR: or },
    });
    return { deletedCount: result.count };
  }

  async updateNeeds(
    sessionId: string,
    needs: NeedsProfile,
    extras?: {
      phase?: ConciergePhase;
      title?: string;
      resultIds?: string[];
    },
  ) {
    return this.prisma.conciergeSession.update({
      where: { id: sessionId },
      data: {
        needs: needs as unknown as Prisma.InputJsonValue,
        ...(extras?.phase ? { phase: extras.phase } : {}),
        ...(extras?.title ? { title: extras.title } : {}),
        ...(extras?.resultIds ? { resultIds: extras.resultIds } : {}),
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async addMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    kind?: ConciergeMessageKind;
    content: string;
    colegioIds?: string[];
  }) {
    return this.prisma.conciergeMessage.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: params.sessionId,
        role: params.role,
        kind: params.kind ?? ConciergeMessageKind.text,
        content: params.content,
        colegioIds: params.colegioIds ?? [],
      },
    });
  }

  async addMessages(
    sessionId: string,
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      kind?: ConciergeMessageKind;
      content: string;
      colegioIds?: string[];
    }>,
  ) {
    const created = [];
    for (const message of messages) {
      created.push(await this.addMessage({ sessionId, ...message }));
    }
    return created;
  }
}
