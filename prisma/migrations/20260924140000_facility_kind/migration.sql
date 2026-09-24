-- CreateEnum
CREATE TYPE "FacilityKind" AS ENUM ('SCHOOL', 'KINDERGARTEN', 'CANTEEN');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "dgisId" TEXT,
ADD COLUMN     "kind" "FacilityKind" NOT NULL DEFAULT 'SCHOOL',
ADD COLUMN     "rubric" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "School_dgisId_key" ON "School"("dgisId");

