-- Review de colégios: submissão, aprovação e rejeição com motivo.

ALTER TABLE "schools"
  ADD COLUMN "submittedForReviewAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" UUID;
