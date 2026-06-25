ALTER TABLE "SectionTeacher" ADD COLUMN "retiredAt" TIMESTAMP(3);

UPDATE "SectionTeacher" AS st
SET
  "retiredAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "_SectionTeachers" AS active
  WHERE active."A" = st."sectionId"
    AND active."B" = st."teacherId"
);

CREATE INDEX "SectionTeacher_retiredAt_idx" ON "SectionTeacher"("retiredAt");
