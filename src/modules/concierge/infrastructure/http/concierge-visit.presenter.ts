import { ConciergeVisit, ConciergeVisitStatus } from '@prisma/client';

type VisitSchool = {
  id: string;
  name: string;
  slug: string;
};

export type ConciergeVisitRecord = ConciergeVisit & {
  school: VisitSchool;
};

export function presentConciergeVisit(visit: ConciergeVisitRecord) {
  return {
    id: visit.id,
    code: visit.code,
    schoolId: visit.schoolId,
    schoolSlug: visit.school.slug,
    schoolName: visit.school.name,
    date: visit.date.toISOString().slice(0, 10),
    time: visit.time,
    contactName: visit.contactName,
    contactPhone: visit.contactPhone,
    status: visit.status as ConciergeVisitStatus,
    rejectionReason: visit.rejectionReason ?? null,
    decidedAt: visit.decidedAt?.toISOString() ?? null,
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  };
}
