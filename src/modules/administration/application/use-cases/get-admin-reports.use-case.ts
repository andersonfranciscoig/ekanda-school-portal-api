import { Injectable } from '@nestjs/common';
import { PaymentStatus, SchoolStatus, UserRole } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';

const PT_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

@Injectable()
export class GetAdminReportsUseCase implements UseCase<void, unknown> {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const now = new Date();
    const months = 6;
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [
      colegiosCadastrados,
      colegiosAtivos,
      familias,
      pesquisas,
      recomendacoes,
      candidaturas,
      pagamentosAgg,
      schoolsByMonth,
      applicationsByMonth,
      paymentsByMonth,
      searchesByMonth,
    ] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.school.count({ where: { status: SchoolStatus.ACTIVE } }),
      this.prisma.userPlatformRole.count({ where: { role: UserRole.GUARDIAN } }),
      this.prisma.search.count(),
      this.prisma.recommendation.count(),
      this.prisma.application.count(),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.school.findMany({
        where: { createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
      this.prisma.application.findMany({
        where: { submittedAt: { gte: seriesStart } },
        select: { submittedAt: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: seriesStart },
        },
        select: { paidAt: true, amount: true },
      }),
      this.prisma.search.findMany({
        where: { createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
    ]);

    const monthBuckets = buildMonthBuckets(months, now);

    for (const row of schoolsByMonth) {
      incrementBucket(monthBuckets, row.createdAt, 'colegios');
    }
    for (const row of applicationsByMonth) {
      incrementBucket(monthBuckets, row.submittedAt, 'candidaturas');
    }
    for (const row of paymentsByMonth) {
      if (!row.paidAt) continue;
      incrementBucket(monthBuckets, row.paidAt, 'receita', Number(row.amount));
    }
    for (const row of searchesByMonth) {
      incrementBucket(monthBuckets, row.createdAt, 'pesquisas');
    }

    let cumulativeSchools =
      (await this.prisma.school.count({
        where: { createdAt: { lt: seriesStart } },
      })) ?? 0;

    const series = monthBuckets.map((bucket) => {
      cumulativeSchools += bucket.colegios;
      return {
        mes: bucket.label,
        colegios: cumulativeSchools,
        candidaturas: bucket.candidaturas,
        receita: bucket.receita,
        pesquisas: bucket.pesquisas,
      };
    });

    return {
      colegiosCadastrados,
      colegiosAtivos,
      familias,
      pesquisas,
      recomendacoes,
      candidaturas,
      pagamentos: pagamentosAgg._count._all,
      receita: Number(pagamentosAgg._sum.amount ?? 0),
      series,
    };
  }
}

type MonthBucket = {
  key: string;
  label: string;
  colegios: number;
  candidaturas: number;
  receita: number;
  pesquisas: number;
};

function buildMonthBuckets(months: number, now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: PT_MONTHS[d.getMonth()] ?? '—',
      colegios: 0,
      candidaturas: 0,
      receita: 0,
      pesquisas: 0,
    });
  }
  return buckets;
}

function incrementBucket(
  buckets: MonthBucket[],
  date: Date,
  field: 'colegios' | 'candidaturas' | 'pesquisas' | 'receita',
  amount = 1,
) {
  const key = `${date.getFullYear()}-${date.getMonth()}`;
  const bucket = buckets.find((row) => row.key === key);
  if (!bucket) return;
  if (field === 'receita') {
    bucket.receita += amount;
    return;
  }
  bucket[field] += amount;
}
