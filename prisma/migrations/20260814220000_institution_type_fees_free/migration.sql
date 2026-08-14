-- AlterEnum
CREATE TYPE "InstitutionType" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "institutionType" "InstitutionType" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "school_prices" ADD COLUMN "feesAreFree" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "schools_institutionType_idx" ON "schools"("institutionType");
