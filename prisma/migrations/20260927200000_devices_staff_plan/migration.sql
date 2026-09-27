-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('MANUAL', 'DEVICE');

-- CreateEnum
CREATE TYPE "DishCategory" AS ENUM ('SOUP', 'MAIN', 'HOT_DRINK', 'COLD');

-- CreateEnum
CREATE TYPE "DeviceKind" AS ENUM ('PROBE', 'FRIDGE');

-- AlterEnum
ALTER TYPE "LogType" ADD VALUE 'WASTE';

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "rule" TEXT;

-- AlterTable
ALTER TABLE "KitchenLog" ADD COLUMN     "aiWastePct" INTEGER,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "source" "LogSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "category" "DishCategory" NOT NULL DEFAULT 'MAIN',
ADD COLUMN     "offPlanReason" TEXT,
ADD COLUMN     "planItemId" TEXT;

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "DeviceKind" NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "lastValue" DOUBLE PRECISION,
    "revokedAt" TIMESTAMP(3),
    "armedTarget" TEXT,
    "armedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "target" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCheck" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoHash" TEXT,
    "aiStatus" "PhotoCheck" NOT NULL DEFAULT 'PENDING',
    "aiIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiSummary" TEXT,
    "aiModel" TEXT,
    "aiCheckedAt" TIMESTAMP(3),

    CONSTRAINT "StaffCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuPlanItem" (
    "id" TEXT NOT NULL,
    "kind" "FacilityKind" NOT NULL,
    "day" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DishCategory" NOT NULL,
    "portionG" INTEGER NOT NULL,
    "mainIngredient" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_keyHash_key" ON "Device"("keyHash");

-- CreateIndex
CREATE INDEX "Device_schoolId_idx" ON "Device"("schoolId");

-- CreateIndex
CREATE INDEX "DeviceReading_deviceId_createdAt_idx" ON "DeviceReading"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffCheck_schoolId_createdAt_idx" ON "StaffCheck"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "MenuPlanItem_kind_day_idx" ON "MenuPlanItem"("kind", "day");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "MenuPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceReading" ADD CONSTRAINT "DeviceReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCheck" ADD CONSTRAINT "StaffCheck_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

