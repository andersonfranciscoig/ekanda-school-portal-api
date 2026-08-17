-- Área jurídica — validação fiscal (NIF)

CREATE TYPE "SchoolNifStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED');
CREATE TYPE "SchoolNifVerificationMode" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "SchoolLegalAuditAction" AS ENUM (
  'NIF_SUBMITTED',
  'NIF_VERIFIED_MANUAL',
  'NIF_VERIFIED_AUTO',
  'NIF_REJECTED'
);

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEGAL';

CREATE TABLE "school_legal_profiles" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "ownerUserId" UUID,
    "nif" TEXT,
    "nifStatus" "SchoolNifStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submittedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" UUID,
    "verifiedByName" TEXT,
    "verificationMode" "SchoolNifVerificationMode",
    "rejectionReason" TEXT,
    "lookupSnapshot" JSONB,
    "sectionUnread" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_legal_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_legal_profiles_schoolId_key" ON "school_legal_profiles"("schoolId");
CREATE UNIQUE INDEX "school_legal_profiles_nif_key" ON "school_legal_profiles"("nif");
CREATE INDEX "school_legal_profiles_nifStatus_idx" ON "school_legal_profiles"("nifStatus");

ALTER TABLE "school_legal_profiles" ADD CONSTRAINT "school_legal_profiles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "school_legal_audit_entries" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "schoolName" TEXT NOT NULL,
    "action" "SchoolLegalAuditAction" NOT NULL,
    "actorUserId" UUID NOT NULL,
    "actorName" TEXT NOT NULL,
    "nif" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_legal_audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_legal_audit_entries_schoolId_idx" ON "school_legal_audit_entries"("schoolId");
CREATE INDEX "school_legal_audit_entries_createdAt_idx" ON "school_legal_audit_entries"("createdAt");

ALTER TABLE "school_legal_audit_entries" ADD CONSTRAINT "school_legal_audit_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
