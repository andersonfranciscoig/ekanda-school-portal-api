-- CreateEnum
CREATE TYPE "ConciergePhase" AS ENUM ('greeting', 'collecting', 'processing', 'results', 'adjusting');

-- CreateEnum
CREATE TYPE "ConciergeMessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "ConciergeMessageKind" AS ENUM ('text', 'processing', 'results', 'compare', 'decision', 'empty', 'error');

-- CreateEnum
CREATE TYPE "ConciergeVisitStatus" AS ENUM ('PENDING_SCHOOL_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "concierge_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "deviceId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Nova procura',
    "phase" "ConciergePhase" NOT NULL DEFAULT 'collecting',
    "needs" JSONB NOT NULL,
    "resultIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concierge_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concierge_messages" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "role" "ConciergeMessageRole" NOT NULL,
    "kind" "ConciergeMessageKind" NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "colegioIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concierge_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concierge_visits" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "schoolId" UUID NOT NULL,
    "sessionId" UUID,
    "userId" UUID,
    "date" DATE NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "status" "ConciergeVisitStatus" NOT NULL DEFAULT 'PENDING_SCHOOL_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concierge_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concierge_sessions_userId_idx" ON "concierge_sessions"("userId");
CREATE INDEX "concierge_sessions_deviceId_idx" ON "concierge_sessions"("deviceId");
CREATE INDEX "concierge_sessions_updatedAt_idx" ON "concierge_sessions"("updatedAt");
CREATE INDEX "concierge_messages_sessionId_idx" ON "concierge_messages"("sessionId");
CREATE INDEX "concierge_messages_createdAt_idx" ON "concierge_messages"("createdAt");
CREATE UNIQUE INDEX "concierge_visits_code_key" ON "concierge_visits"("code");
CREATE INDEX "concierge_visits_schoolId_idx" ON "concierge_visits"("schoolId");
CREATE INDEX "concierge_visits_sessionId_idx" ON "concierge_visits"("sessionId");
CREATE INDEX "concierge_visits_userId_idx" ON "concierge_visits"("userId");
CREATE INDEX "concierge_visits_code_idx" ON "concierge_visits"("code");

-- AddForeignKey
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "concierge_messages" ADD CONSTRAINT "concierge_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "concierge_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "concierge_visits" ADD CONSTRAINT "concierge_visits_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "concierge_visits" ADD CONSTRAINT "concierge_visits_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "concierge_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "concierge_visits" ADD CONSTRAINT "concierge_visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
