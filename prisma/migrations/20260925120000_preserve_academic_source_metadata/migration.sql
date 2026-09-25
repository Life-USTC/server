ALTER TABLE "Section"
  ADD COLUMN "requiredWeeks" INTEGER,
  ADD COLUMN "catalogAdminClasses" JSONB;

ALTER TABLE "Exam"
  ADD COLUMN "grades" TEXT,
  ADD COLUMN "adminClassNames" TEXT,
  ADD COLUMN "monitors" JSONB;
