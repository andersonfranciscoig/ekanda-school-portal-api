import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { normalizePage } from '../../../../shared/application/pagination';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  presentAdminPayment,
  presentAdminPaymentDetail,
} from '../services/admin.presenter';

export type ViewPaymentsInput = {
  status?: PaymentStatus;
  q?: string;
  schoolId?: string;
  page?: number;
  pageSize?: number;
};

const paymentListInclude = {
  school: { select: { id: true, name: true, slug: true } },
  plan: { select: { id: true, code: true, name: true } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class ViewPaymentsUseCase implements UseCase<ViewPaymentsInput, unknown> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ViewPaymentsInput) {
    const { page, pageSize, skip } = normalizePage(input.page, input.pageSize);
    const where = this.buildWhere(input);

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentListInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: rows.map(presentAdminPayment),
      total,
      page,
      pageSize,
    };
  }

  async getById(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        ...paymentListInclude,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!payment) throw new EntityNotFoundException('Payment not found');
    return presentAdminPaymentDetail(payment);
  }

  private buildWhere(input: ViewPaymentsInput): Prisma.PaymentWhereInput {
    const q = input.q?.trim();
    const uuid = q ? this.asUuidOrUndefined(q) : undefined;
    const or: Prisma.PaymentWhereInput[] = [];
    if (q) {
      if (uuid) or.push({ id: uuid });
      or.push({ externalReference: { contains: q, mode: 'insensitive' } });
      or.push({ externalTransactionId: { contains: q, mode: 'insensitive' } });
      or.push({ expressPhone: { contains: q } });
      or.push({ school: { name: { contains: q, mode: 'insensitive' } } });
      or.push({ school: { slug: { contains: q, mode: 'insensitive' } } });
    }
    return {
      ...(input.status ? { status: input.status } : {}),
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      ...(or.length ? { OR: or } : {}),
    };
  }

  private asUuidOrUndefined(value: string): string | undefined {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : undefined;
  }
}
