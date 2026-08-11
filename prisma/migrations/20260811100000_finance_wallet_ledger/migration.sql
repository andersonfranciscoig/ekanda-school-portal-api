-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('SCHOOL', 'PLATFORM');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WalletTransactionCategory" AS ENUM ('SUBSCRIPTION', 'PAYMENT', 'REFUND', 'FEE', 'ADJUSTMENT', 'OTHER');

-- AlterTable
ALTER TABLE "subscriptions"
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN     "expressPhone" VARCHAR(20);

-- Unique on externalReference (multiple NULLs allowed)
CREATE UNIQUE INDEX "payments_externalReference_key" ON "payments"("externalReference");

-- Unique on payment_events.externalEventId (multiple NULLs allowed)
DROP INDEX IF EXISTS "payment_events_externalEventId_idx";
CREATE UNIQUE INDEX "payment_events_externalEventId_key" ON "payment_events"("externalEventId");

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "ownerType" "WalletOwnerType" NOT NULL,
    "schoolId" UUID,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'Kz',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "paymentId" UUID,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'Kz',
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "category" "WalletTransactionCategory" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_code_key" ON "wallets"("code");
CREATE INDEX "wallets_schoolId_idx" ON "wallets"("schoolId");
CREATE INDEX "wallets_ownerType_idx" ON "wallets"("ownerType");
CREATE UNIQUE INDEX "wallet_transactions_reference_key" ON "wallet_transactions"("reference");
CREATE INDEX "wallet_transactions_walletId_idx" ON "wallet_transactions"("walletId");
CREATE INDEX "wallet_transactions_paymentId_idx" ON "wallet_transactions"("paymentId");
CREATE INDEX "wallet_transactions_status_idx" ON "wallet_transactions"("status");
CREATE INDEX "wallet_transactions_createdAt_idx" ON "wallet_transactions"("createdAt");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
