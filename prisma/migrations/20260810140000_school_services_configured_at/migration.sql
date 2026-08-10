-- Distinguish "services never configured" vs "configured with empty list"
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "servicesConfiguredAt" TIMESTAMP(3);
