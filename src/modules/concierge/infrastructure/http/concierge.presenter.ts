import {
  ConciergeMessageKind,
  ConciergeMessageRole,
  ConciergePhase,
  NeedsProfile,
} from '../../domain/concierge.types';

export type ConciergeMessageDto = {
  id: string;
  role: ConciergeMessageRole;
  kind: ConciergeMessageKind;
  content: string;
  colegioIds?: string[];
  createdAt: string;
};

export type ConciergeSessionDto = {
  id: string;
  title: string;
  phase: ConciergePhase;
  needs: NeedsProfile;
  messages: ConciergeMessageDto[];
  resultIds: string[];
  createdAt: string;
  updatedAt: string;
};

export function presentMessage(row: {
  id: string;
  role: string;
  kind: string;
  content: string;
  colegioIds: string[];
  createdAt: Date;
}): ConciergeMessageDto {
  return {
    id: row.id,
    role: row.role as ConciergeMessageRole,
    kind: row.kind as ConciergeMessageKind,
    content: row.content,
    ...(row.colegioIds?.length ? { colegioIds: row.colegioIds } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

export function presentSession(row: {
  id: string;
  title: string;
  phase: string;
  needs: unknown;
  resultIds: string[];
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<{
    id: string;
    role: string;
    kind: string;
    content: string;
    colegioIds: string[];
    createdAt: Date;
  }>;
}): ConciergeSessionDto {
  return {
    id: row.id,
    title: row.title,
    phase: row.phase as ConciergePhase,
    needs: row.needs as NeedsProfile,
    messages: (row.messages ?? []).map(presentMessage),
    resultIds: row.resultIds ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
