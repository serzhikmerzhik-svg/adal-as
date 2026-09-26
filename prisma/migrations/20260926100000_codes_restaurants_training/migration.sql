-- Мейрамхана мен кафе түрлері
ALTER TYPE "FacilityKind" ADD VALUE 'RESTAURANT';
ALTER TYPE "FacilityKind" ADD VALUE 'CAFE';

-- Нысан коды (А-12, М-07 ...)
ALTER TABLE "School" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- Оқу-жаттығу режимі (бұрынғы isDemo)
ALTER TABLE "School" RENAME COLUMN "isDemo" TO "isTraining";
