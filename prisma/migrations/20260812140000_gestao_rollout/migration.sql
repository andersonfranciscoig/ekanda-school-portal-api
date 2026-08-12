-- Plano Gestão — rollout / fila de testes

CREATE TYPE "GestaoModulePhase" AS ENUM ('HIDDEN', 'WAITLIST', 'BETA', 'PRODUCTION');
CREATE TYPE "GestaoWaitlistStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GESTAO';

CREATE TABLE "gestao_module_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "phase" "GestaoModulePhase" NOT NULL DEFAULT 'WAITLIST',
    "description" TEXT NOT NULL,
    "testBaseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gestao_module_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gestao_waitlist_entries" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolSlug" TEXT NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "status" "GestaoWaitlistStatus" NOT NULL DEFAULT 'PENDING',
    "testUrl" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "gestao_waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gestao_waitlist_entries_schoolId_key" ON "gestao_waitlist_entries"("schoolId");
CREATE INDEX "gestao_waitlist_entries_status_idx" ON "gestao_waitlist_entries"("status");
CREATE INDEX "gestao_waitlist_entries_ownerUserId_idx" ON "gestao_waitlist_entries"("ownerUserId");
CREATE INDEX "gestao_waitlist_entries_createdAt_idx" ON "gestao_waitlist_entries"("createdAt");

ALTER TABLE "gestao_waitlist_entries" ADD CONSTRAINT "gestao_waitlist_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gestao_waitlist_entries" ADD CONSTRAINT "gestao_waitlist_entries_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "gestao_module_config" ("id", "phase", "description", "updatedAt")
VALUES (
    'default',
    'WAITLIST',
    'O Plano Gestão transforma a Ekanda no sistema completo de gestão escolar: alunos, turmas, notas, propinas e comunicação com encarregados. Entre na fila para ser um dos primeiros colégios a testar.',
    CURRENT_TIMESTAMP
);
