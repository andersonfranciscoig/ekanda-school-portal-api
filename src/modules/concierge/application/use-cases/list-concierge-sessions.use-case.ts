import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ConciergeSessionStore } from '../services/concierge-session.store';

export type ListConciergeSessionsInput = {
  userId?: string | null;
  deviceId?: string | null;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ListConciergeSessionsUseCase
  implements UseCase<ListConciergeSessionsInput, unknown>
{
  constructor(private readonly store: ConciergeSessionStore) {}

  async execute(input: ListConciergeSessionsInput) {
    const page = Math.max(1, Number(input.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(input.pageSize ?? 20) || 20));
    const { rows, total } = await this.store.listSessions({
      userId: input.userId,
      deviceId: input.deviceId,
      page,
      pageSize,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        phase: row.phase,
        updatedAt: row.updatedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        preview: row.messages[0]?.content?.slice(0, 120) ?? '',
      })),
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }
}
