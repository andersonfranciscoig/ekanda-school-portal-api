-- Beta: tipo de testador (encarregado / colégio) + quotas por área

CREATE TYPE "BetaTesterType" AS ENUM ('GUARDIAN', 'SCHOOL_OWNER');

-- Repor fila — pedidos antigos não tinham tipo de teste
DELETE FROM "beta_access_requests";

ALTER TABLE "platform_settings"
  ADD COLUMN "betaLimitGuardian" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "betaLimitSchoolOwner" INTEGER NOT NULL DEFAULT 20;

ALTER TABLE "beta_access_requests"
  ADD COLUMN "testerType" "BetaTesterType" NOT NULL;

CREATE INDEX "beta_access_requests_testerType_idx" ON "beta_access_requests"("testerType");

UPDATE "platform_settings"
SET
  "betaLimitGuardian" = 50,
  "betaLimitSchoolOwner" = 20,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'default';
