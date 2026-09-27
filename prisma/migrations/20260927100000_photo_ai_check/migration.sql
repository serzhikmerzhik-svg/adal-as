-- CreateEnum
CREATE TYPE "PhotoCheck" AS ENUM ('PENDING', 'OK', 'FLAGGED', 'ERROR', 'DISABLED');

-- AlterTable
ALTER TABLE "KitchenLog" ADD COLUMN     "photoHash" TEXT,
ADD COLUMN     "aiStatus" "PhotoCheck",
ADD COLUMN     "aiIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "aiPortionPct" INTEGER,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiCheckedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "KitchenLog_type_createdAt_idx" ON "KitchenLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenLog_photoHash_idx" ON "KitchenLog"("photoHash");
