-- CreateEnum
CREATE TYPE "Role" AS ENUM ('KITCHEN', 'NURSE', 'SES', 'EDU', 'ADMIN');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('PHOTO', 'FRIDGE_TEMP', 'HOT_TEMP');

-- CreateEnum
CREATE TYPE "Symptom" AS ENUM ('NAUSEA', 'VOMITING', 'DIARRHEA', 'FEVER', 'ABDOMINAL_PAIN', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('MONITORING', 'UNANNOUNCED', 'UNSCHEDULED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "studentsCount" INTEGER NOT NULL,
    "districtId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'GREEN',
    "lastInspectionAt" TIMESTAMP(3),
    "parentToken" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "schoolId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bin" TEXT NOT NULL,
    "certificateValidUntil" TIMESTAMP(3) NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "standardPortionG" INTEGER,
    "batchId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "type" "LogType" NOT NULL,
    "valueC" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "isViolation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "KitchenLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymptomReport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "symptoms" "Symptom"[],
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "SymptomReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentFeedback" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "components" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "relatedBatchId" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closingNote" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "alertId" TEXT,
    "text" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'OPEN',
    "evidencePhotoUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_parentToken_key" ON "School"("parentToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_code_key" ON "Batch"("code");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenLog" ADD CONSTRAINT "KitchenLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenLog" ADD CONSTRAINT "KitchenLog_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomReport" ADD CONSTRAINT "SymptomReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
