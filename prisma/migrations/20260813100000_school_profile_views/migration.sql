-- CreateTable
CREATE TABLE "school_profile_views" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "userId" UUID,
    "deviceId" TEXT,

    CONSTRAINT "school_profile_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_profile_views_schoolId_viewedAt_idx" ON "school_profile_views"("schoolId", "viewedAt");

-- AddForeignKey
ALTER TABLE "school_profile_views" ADD CONSTRAINT "school_profile_views_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
