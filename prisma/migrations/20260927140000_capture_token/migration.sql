-- CreateTable
CREATE TABLE "CaptureToken" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "distanceM" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "CaptureToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaptureToken_schoolId_createdAt_idx" ON "CaptureToken"("schoolId", "createdAt");
