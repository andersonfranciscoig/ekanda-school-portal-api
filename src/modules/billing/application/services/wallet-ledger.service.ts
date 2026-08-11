import { Injectable } from '@nestjs/common';
import {
  Prisma,
  WalletOwnerType,
  WalletStatus,
  WalletTransactionCategory,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  InsufficientWalletBalanceException,
  WalletNotFoundException,
} from '../../domain/exceptions/billing.exceptions';

export type WalletView = {
  id: string;
  code: string;
  ownerType: WalletOwnerType;
  schoolId: string | null;
  status: WalletStatus;
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  updatedAt: string;
};

export type WalletTransactionView = {
  id: string;
  walletId: string;
  paymentId: string | null;
  type: WalletTransactionType;
  amount: number;
  currency: string;
  status: WalletTransactionStatus;
  description: string;
  reference: string;
  category: WalletTransactionCategory;
  metadata: unknown;
  createdAt: string;
};

export type LedgerPostInput = {
  walletId: string;
  type: WalletTransactionType;
  amount: number;
  currency?: string;
  description: string;
  reference: string;
  category: WalletTransactionCategory;
  paymentId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const PLATFORM_WALLET_CODE = 'platform';

@Injectable()
export class WalletLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSchoolWallet(schoolId: string, currency = 'Kz') {
    const code = `school:${schoolId}`;
    return this.prisma.wallet.upsert({
      where: { code },
      update: {},
      create: {
        id: crypto.randomUUID(),
        code,
        ownerType: WalletOwnerType.SCHOOL,
        schoolId,
        currency,
      },
    });
  }

  async ensurePlatformWallet(currency = 'Kz') {
    return this.prisma.wallet.upsert({
      where: { code: PLATFORM_WALLET_CODE },
      update: {},
      create: {
        id: crypto.randomUUID(),
        code: PLATFORM_WALLET_CODE,
        ownerType: WalletOwnerType.PLATFORM,
        schoolId: null,
        currency,
      },
    });
  }

  presentWallet(row: {
    id: string;
    code: string;
    ownerType: WalletOwnerType;
    schoolId: string | null;
    status: WalletStatus;
    balance: Prisma.Decimal;
    availableBalance: Prisma.Decimal;
    pendingBalance: Prisma.Decimal;
    currency: string;
    updatedAt: Date;
  }): WalletView {
    return {
      id: row.id,
      code: row.code,
      ownerType: row.ownerType,
      schoolId: row.schoolId,
      status: row.status,
      balance: Number(row.balance),
      availableBalance: Number(row.availableBalance),
      pendingBalance: Number(row.pendingBalance),
      currency: row.currency,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  presentTransaction(row: {
    id: string;
    walletId: string;
    paymentId: string | null;
    type: WalletTransactionType;
    amount: Prisma.Decimal;
    currency: string;
    status: WalletTransactionStatus;
    description: string;
    reference: string;
    category: WalletTransactionCategory;
    metadata: unknown;
    createdAt: Date;
  }): WalletTransactionView {
    return {
      id: row.id,
      walletId: row.walletId,
      paymentId: row.paymentId,
      type: row.type,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      description: row.description,
      reference: row.reference,
      category: row.category,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Post a ledger entry and update wallet balances atomically.
   * Idempotent by `reference`.
   */
  async post(input: LedgerPostInput) {
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      throw new InsufficientWalletBalanceException('Invalid transaction amount');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findUnique({
        where: { reference: input.reference },
      });
      if (existing) {
        const wallet = await tx.wallet.findUnique({
          where: { id: existing.walletId },
        });
        if (!wallet) throw new WalletNotFoundException();
        return {
          duplicated: true,
          wallet,
          transaction: existing,
        };
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: input.walletId },
      });
      if (!wallet) throw new WalletNotFoundException();

      const delta =
        input.type === WalletTransactionType.DEBIT
          ? -input.amount
          : input.amount;
      const nextBalance = Number(wallet.availableBalance) + delta;
      if (nextBalance < 0) {
        throw new InsufficientWalletBalanceException();
      }

      const transaction = await tx.walletTransaction.create({
        data: {
          id: crypto.randomUUID(),
          walletId: wallet.id,
          paymentId: input.paymentId ?? null,
          type: input.type,
          amount: input.amount,
          currency: input.currency ?? wallet.currency,
          status: WalletTransactionStatus.COMPLETED,
          description: input.description,
          reference: input.reference,
          category: input.category,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue,
        },
      });

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: nextBalance,
          availableBalance: nextBalance,
        },
      });

      return { duplicated: false, wallet: updated, transaction };
    });
  }
}
