import {
  WalletTransactionCategory,
  WalletTransactionType,
} from '@prisma/client';
import { InsufficientWalletBalanceException } from '../../domain/exceptions/billing.exceptions';
import { WalletLedgerService } from './wallet-ledger.service';

describe('WalletLedgerService', () => {
  const wallet = {
    id: 'wallet-1',
    availableBalance: 100,
    balance: 100,
    currency: 'Kz',
  };

  function makeService(overrides?: {
    existingTx?: unknown;
    wallet?: typeof wallet | null;
  }) {
    const tx = {
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue(overrides?.existingTx ?? null),
        create: jest.fn().mockImplementation(async ({ data }) => data),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue(overrides?.wallet ?? wallet),
        update: jest.fn().mockImplementation(async ({ data }) => ({
          ...wallet,
          ...data,
        })),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    return {
      service: new WalletLedgerService(prisma as never),
      tx,
    };
  }

  it('credits the wallet and creates a transaction', async () => {
    const { service, tx } = makeService();
    const result = await service.post({
      walletId: wallet.id,
      type: WalletTransactionType.CREDIT,
      amount: 50,
      description: 'test credit',
      reference: 'ref-credit-1',
      category: WalletTransactionCategory.SUBSCRIPTION,
    });

    expect(result.duplicated).toBe(false);
    expect(tx.walletTransaction.create).toHaveBeenCalled();
    expect(tx.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availableBalance: 150 }),
      }),
    );
  });

  it('is idempotent for the same reference', async () => {
    const existing = { id: 'tx-1', walletId: wallet.id, reference: 'dup' };
    const { service, tx } = makeService({ existingTx: existing });
    const result = await service.post({
      walletId: wallet.id,
      type: WalletTransactionType.CREDIT,
      amount: 50,
      description: 'dup',
      reference: 'dup',
      category: WalletTransactionCategory.SUBSCRIPTION,
    });

    expect(result.duplicated).toBe(true);
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('rejects a debit that would make the balance negative', async () => {
    const { service } = makeService();
    await expect(
      service.post({
        walletId: wallet.id,
        type: WalletTransactionType.DEBIT,
        amount: 150,
        description: 'overdraw',
        reference: 'ref-debit-1',
        category: WalletTransactionCategory.FEE,
      }),
    ).rejects.toBeInstanceOf(InsufficientWalletBalanceException);
  });
});
