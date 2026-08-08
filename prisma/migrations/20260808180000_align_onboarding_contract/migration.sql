-- EKANDA: align onboarding schema with FE contract
-- Migration: 20260808180000_align_onboarding_contract
-- Safe data steps included. Review before `prisma migrate deploy`.

-- ─────────────────────────────────────────────
-- 1) New enums
-- ─────────────────────────────────────────────

CREATE TYPE "GalleryKind" AS ENUM ('PHOTO', 'VIDEO');

CREATE TYPE "EducationLevelCode" AS ENUM (
  'creche',
  'pre_escolar',
  'primario',
  'i_ciclo',
  'ii_ciclo',
  'medio'
);

CREATE TYPE "SchoolServiceCatalogId" AS ENUM (
  'transporte',
  'cantina',
  'biblioteca',
  'laboratorio',
  'campo',
  'informatica',
  'ingles',
  'seguranca',
  'enfermaria',
  'extra'
);

-- ─────────────────────────────────────────────
-- 2) Shift: FULL_DAY → DOUBLE; add NIGHT
--    (school_classes does not yet have shift; applications.requestedShift does)
-- ─────────────────────────────────────────────

CREATE TYPE "Shift_new" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'DOUBLE');

ALTER TABLE "applications"
  ALTER COLUMN "requestedShift" TYPE "Shift_new"
  USING (
    CASE "requestedShift"::text
      WHEN 'MORNING' THEN 'MORNING'
      WHEN 'AFTERNOON' THEN 'AFTERNOON'
      WHEN 'FULL_DAY' THEN 'DOUBLE'
      ELSE NULL
    END::"Shift_new"
  );

ALTER TYPE "Shift" RENAME TO "Shift_old";
ALTER TYPE "Shift_new" RENAME TO "Shift";
DROP TYPE "Shift_old";

-- ─────────────────────────────────────────────
-- 3) User.role → user_platform_roles (preserve roles)
-- ─────────────────────────────────────────────

CREATE TABLE "user_platform_roles" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "UserRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_platform_roles_pkey" PRIMARY KEY ("id")
);

INSERT INTO "user_platform_roles" ("id", "userId", "role", "createdAt")
SELECT gen_random_uuid(), "id", "role", CURRENT_TIMESTAMP
FROM "users";

CREATE INDEX "user_platform_roles_userId_idx" ON "user_platform_roles"("userId");
CREATE INDEX "user_platform_roles_role_idx" ON "user_platform_roles"("role");
CREATE UNIQUE INDEX "user_platform_roles_userId_role_key" ON "user_platform_roles"("userId", "role");

ALTER TABLE "user_platform_roles"
  ADD CONSTRAINT "user_platform_roles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "users_role_idx";
ALTER TABLE "users" DROP COLUMN "role";

-- ─────────────────────────────────────────────
-- 4) School: foundedAt → foundedYear + new fields
-- ─────────────────────────────────────────────

ALTER TABLE "schools"
  ADD COLUMN "foundedYear" INTEGER,
  ADD COLUMN "approximateStudents" INTEGER,
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "facebook" TEXT;

UPDATE "schools"
SET "foundedYear" = EXTRACT(YEAR FROM "foundedAt")::integer
WHERE "foundedAt" IS NOT NULL;

ALTER TABLE "schools" DROP COLUMN "foundedAt";

-- ─────────────────────────────────────────────
-- 5) SchoolLocation: drop district (all current values NULL)
-- ─────────────────────────────────────────────

ALTER TABLE "school_locations" DROP COLUMN "district";

-- ─────────────────────────────────────────────
-- 6) SchoolEducationLevel (new)
-- ─────────────────────────────────────────────

CREATE TABLE "school_education_levels" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "level" "EducationLevelCode" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_education_levels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_education_levels_schoolId_idx" ON "school_education_levels"("schoolId");
CREATE UNIQUE INDEX "school_education_levels_schoolId_level_key" ON "school_education_levels"("schoolId", "level");

ALTER TABLE "school_education_levels"
  ADD CONSTRAINT "school_education_levels_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- 7) SchoolClass: name → classLabel (+ vacancies, shift, schedule)
--    Table currently empty — rename is still used for future-proofing.
-- ─────────────────────────────────────────────

ALTER TABLE "school_classes" RENAME COLUMN "name" TO "classLabel";
ALTER TABLE "school_classes" DROP COLUMN "description";
ALTER TABLE "school_classes" ADD COLUMN "vacancies" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "school_classes" ADD COLUMN "shift" "Shift" NOT NULL DEFAULT 'MORNING';
ALTER TABLE "school_classes" ADD COLUMN "schedule" TEXT;
ALTER TABLE "school_classes" ALTER COLUMN "shift" DROP DEFAULT;

-- ─────────────────────────────────────────────
-- 8) SchoolService → catalog serviceId
--    Table currently empty. Structure rebuilt in place.
-- ─────────────────────────────────────────────

DROP INDEX IF EXISTS "school_services_schoolId_isActive_idx";

ALTER TABLE "school_services" DROP COLUMN "description";
ALTER TABLE "school_services" DROP COLUMN "isActive";
ALTER TABLE "school_services" DROP COLUMN "name";
ALTER TABLE "school_services" ADD COLUMN "serviceId" "SchoolServiceCatalogId";

-- No legacy rows to map. Enforce NOT NULL after structure change.
ALTER TABLE "school_services" ALTER COLUMN "serviceId" SET NOT NULL;

CREATE UNIQUE INDEX "school_services_schoolId_serviceId_key"
  ON "school_services"("schoolId", "serviceId");

-- ─────────────────────────────────────────────
-- 9) SchoolPrice → 1:1 fee columns (AOA)
--    Table currently empty — no multi-row aggregation needed.
-- ─────────────────────────────────────────────

ALTER TABLE "school_prices" DROP CONSTRAINT IF EXISTS "school_prices_schoolClassId_fkey";
DROP INDEX IF EXISTS "school_prices_schoolClassId_idx";
DROP INDEX IF EXISTS "school_prices_schoolId_isActive_idx";

ALTER TABLE "school_prices" DROP COLUMN "amount";
ALTER TABLE "school_prices" DROP COLUMN "billingPeriod";
ALTER TABLE "school_prices" DROP COLUMN "description";
ALTER TABLE "school_prices" DROP COLUMN "isActive";
ALTER TABLE "school_prices" DROP COLUMN "name";
ALTER TABLE "school_prices" DROP COLUMN "schoolClassId";

ALTER TABLE "school_prices"
  ADD COLUMN "enrollmentFee" DECIMAL(12, 2),
  ADD COLUMN "tuitionFee" DECIMAL(12, 2),
  ADD COLUMN "transportFee" DECIMAL(12, 2),
  ADD COLUMN "mealFee" DECIMAL(12, 2),
  ADD COLUMN "otherFees" DECIMAL(12, 2);

ALTER TABLE "school_prices" ALTER COLUMN "currency" SET DEFAULT 'AOA';

CREATE UNIQUE INDEX "school_prices_schoolId_key" ON "school_prices"("schoolId");

-- ─────────────────────────────────────────────
-- 10) SchoolGallery: type→kind, sortOrder→order, drop caption
--     Table currently empty.
-- ─────────────────────────────────────────────

DROP INDEX IF EXISTS "school_galleries_schoolId_sortOrder_idx";

ALTER TABLE "school_galleries" ADD COLUMN "kind" "GalleryKind";
ALTER TABLE "school_galleries" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "school_galleries" ADD COLUMN "fileName" TEXT;

-- Preserve mapping if rows appear before deploy:
UPDATE "school_galleries"
SET "kind" = CASE "type"::text
  WHEN 'IMAGE' THEN 'PHOTO'::"GalleryKind"
  WHEN 'VIDEO' THEN 'VIDEO'::"GalleryKind"
  ELSE 'PHOTO'::"GalleryKind"
END;

UPDATE "school_galleries" SET "order" = "sortOrder";

ALTER TABLE "school_galleries" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "school_galleries" DROP COLUMN "caption";
ALTER TABLE "school_galleries" DROP COLUMN "sortOrder";
ALTER TABLE "school_galleries" DROP COLUMN "type";

CREATE INDEX "school_galleries_schoolId_order_idx" ON "school_galleries"("schoolId", "order");

DROP TYPE "GalleryMediaType";
