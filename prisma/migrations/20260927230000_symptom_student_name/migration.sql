-- AlterTable
ALTER TABLE "SymptomReport" ADD COLUMN     "otherNote" TEXT,
ADD COLUMN     "studentName" TEXT;

-- CreateIndex
CREATE INDEX "SymptomReport_schoolId_reportedAt_idx" ON "SymptomReport"("schoolId", "reportedAt");

