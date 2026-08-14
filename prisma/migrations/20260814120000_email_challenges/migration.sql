-- CreateEnum
CREATE TYPE "EmailChallengePurpose" AS ENUM ('REGISTER', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "email_challenges" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "EmailChallengePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "payloadJson" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_challenges_email_purpose_idx" ON "email_challenges"("email", "purpose");

-- CreateIndex
CREATE INDEX "email_challenges_expiresAt_idx" ON "email_challenges"("expiresAt");
