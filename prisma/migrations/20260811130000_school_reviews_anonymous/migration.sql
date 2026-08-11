-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "reviews" ALTER COLUMN "isPublished" SET DEFAULT true;
ALTER TABLE "reviews" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "reviews" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_userId_fkey";

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reviews_deviceId_schoolId_key" ON "reviews"("deviceId", "schoolId");
CREATE INDEX IF NOT EXISTS "reviews_deviceId_idx" ON "reviews"("deviceId");
