-- Platform beta gate

CREATE TYPE "BetaAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "betaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappCommunityUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "beta_access_requests" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "BetaAccessStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sessionTokenHash" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beta_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_access_requests_email_key" ON "beta_access_requests"("email");
CREATE INDEX "beta_access_requests_phone_idx" ON "beta_access_requests"("phone");
CREATE INDEX "beta_access_requests_status_idx" ON "beta_access_requests"("status");
CREATE INDEX "beta_access_requests_createdAt_idx" ON "beta_access_requests"("createdAt");

INSERT INTO "platform_settings" ("id", "betaEnabled", "whatsappCommunityUrl", "updatedAt")
VALUES ('default', false, NULL, CURRENT_TIMESTAMP);
