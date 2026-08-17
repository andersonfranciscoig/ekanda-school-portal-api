-- Prazo de submissão NIF (10 dias desde aprovação)

ALTER TABLE "school_legal_profiles"
ADD COLUMN "nifDeadlineAt" TIMESTAMP(3),
ADD COLUMN "nifReminderSentAt" TIMESTAMP(3);

-- Perfis em falta para colégios ACTIVE
INSERT INTO "school_legal_profiles" (
  "id",
  "schoolId",
  "nifStatus",
  "sectionUnread",
  "nifDeadlineAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  s."id",
  'NOT_SUBMITTED',
  '{}',
  COALESCE(s."reviewedAt", s."createdAt") + INTERVAL '10 days',
  NOW(),
  NOW()
FROM "schools" s
WHERE s."status" = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM "school_legal_profiles" lp WHERE lp."schoolId" = s."id"
  );

-- Backfill deadline para colégios ACTIVE sem NIF submetido/verificado
UPDATE "school_legal_profiles" lp
SET "nifDeadlineAt" = COALESCE(s."reviewedAt", s."createdAt") + INTERVAL '10 days'
FROM "schools" s
WHERE s."id" = lp."schoolId"
  AND s."status" = 'ACTIVE'
  AND lp."nifStatus" IN ('NOT_SUBMITTED', 'REJECTED')
  AND lp."nifDeadlineAt" IS NULL;

CREATE INDEX "school_legal_profiles_nifDeadlineAt_idx" ON "school_legal_profiles"("nifDeadlineAt");
