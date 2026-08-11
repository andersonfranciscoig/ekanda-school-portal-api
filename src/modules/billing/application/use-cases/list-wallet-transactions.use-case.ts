import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { WalletLedgerService } from '../services/wallet-ledger.service';

export type ListWalletTransactionsInput = {
  actorUserId: string;
  schoolId: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ListWalletTransactionsUseCase
  implements UseCase<ListWalletTransactionsInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    private readonly ledger: WalletLedgerService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: ListWalletTransactionsInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);
    const wallet = await this.ledger.ensureSchoolWallet(input.schoolId);
    const page = Math.max(1, Number(input.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(input.pageSize ?? 20) || 20));

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      wallet: this.ledger.presentWallet(wallet),
      items: rows.map((row) => this.ledger.presentTransaction(row)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
      },
    };
  }
}
