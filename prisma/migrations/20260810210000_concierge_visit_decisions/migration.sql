-- AlterEnum
ALTER TYPE "ConciergeVisitStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "concierge_visits" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "concierge_visits" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "concierge_visits" ADD COLUMN "decidedByUserId" UUID;

-- CreateIndex
CREATE INDEX "concierge_visits_status_idx" ON "concierge_visits"("status");

-- AddForeignKey
ALTER TABLE "concierge_visits"
  ADD CONSTRAINT "concierge_visits_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
