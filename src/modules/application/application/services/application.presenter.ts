import { ApplicationStatus, Prisma } from '@prisma/client';
import {
  ageFromBirthDate,
  fullName,
  shortCode,
} from '../../../../shared/application/pagination';

export const PENDING_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.DOCUMENT_REQUESTED,
];

export const DECIDABLE_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.DOCUMENT_REQUESTED,
];

export function applicationCode(id: string): string {
  return shortCode('EKD-APP-', id);
}

export const applicationListInclude = {
  school: { select: { id: true, name: true, slug: true } },
  student: {
    select: { id: true, firstName: true, lastName: true, birthDate: true },
  },
  guardian: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  },
  schoolClass: { select: { classLabel: true } },
} satisfies Prisma.ApplicationInclude;

export const applicationDetailInclude = {
  ...applicationListInclude,
  documents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      name: true,
      type: true,
      url: true,
      status: true,
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      toStatus: true,
      reason: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ApplicationInclude;

export type ApplicationListRow = Prisma.ApplicationGetPayload<{
  include: typeof applicationListInclude;
}>;

export type ApplicationDetailRow = Prisma.ApplicationGetPayload<{
  include: typeof applicationDetailInclude;
}>;

export function presentApplicationListItem(row: ApplicationListRow) {
  return {
    id: row.id,
    code: applicationCode(row.id),
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    classLabel: row.schoolClass?.classLabel ?? null,
    requestedShift: row.requestedShift,
    school: row.school,
    student: {
      id: row.student.id,
      name: fullName(row.student.firstName, row.student.lastName),
      birthDate: row.student.birthDate.toISOString().slice(0, 10),
      age: ageFromBirthDate(row.student.birthDate),
    },
    guardian: {
      id: row.guardian.id,
      name: fullName(row.guardian.firstName, row.guardian.lastName),
      email: row.guardian.email,
      phone: row.guardian.phone,
    },
  };
}

export function presentApplicationDetail(row: ApplicationDetailRow) {
  return {
    ...presentApplicationListItem(row),
    notes: row.notes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    documents: row.documents.map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      url: document.url,
      status: document.status,
    })),
    timeline: row.statusHistory.map((entry) => ({
      id: entry.id,
      title: entry.toStatus,
      description: entry.reason,
      at: entry.createdAt.toISOString(),
    })),
  };
}
