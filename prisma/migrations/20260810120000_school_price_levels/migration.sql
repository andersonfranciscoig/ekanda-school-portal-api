-- EKANDA: SchoolPrice per education level (min/max) + global otherFees
-- No rows in school_prices at migration time — safe destructive column drop.

-- 1) Drop global fee columns from school_prices
ALTER TABLE "school_prices" DROP COLUMN IF EXISTS "enrollmentFee";
ALTER TABLE "school_prices" DROP COLUMN IF EXISTS "tuitionFee";
ALTER TABLE "school_prices" DROP COLUMN IF EXISTS "transportFee";
ALTER TABLE "school_prices" DROP COLUMN IF EXISTS "mealFee";

-- 2) Create school_price_levels
CREATE TABLE "school_price_levels" (
    "id" UUID NOT NULL,
    "schoolPriceId" UUID NOT NULL,
    "levelId" "EducationLevelCode" NOT NULL,
    "enrollmentFeeMin" DECIMAL(12,2),
    "enrollmentFeeMax" DECIMAL(12,2),
    "tuitionFeeMin" DECIMAL(12,2),
    "tuitionFeeMax" DECIMAL(12,2),
    "transportFeeMin" DECIMAL(12,2),
    "transportFeeMax" DECIMAL(12,2),
    "mealFeeMin" DECIMAL(12,2),
    "mealFeeMax" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_price_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_price_levels_schoolPriceId_levelId_key" ON "school_price_levels"("schoolPriceId", "levelId");
CREATE INDEX "school_price_levels_schoolPriceId_idx" ON "school_price_levels"("schoolPriceId");
CREATE INDEX "school_price_levels_levelId_idx" ON "school_price_levels"("levelId");

ALTER TABLE "school_price_levels"
  ADD CONSTRAINT "school_price_levels_schoolPriceId_fkey"
  FOREIGN KEY ("schoolPriceId") REFERENCES "school_prices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
