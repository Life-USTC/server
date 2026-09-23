-- Expand-only: Teacher jwId is populated from schedule assignment.teacherId by
-- the static loader. A later snapshot-backed migration can backfill legacy rows
-- and make Campus/Teacher jwId required.
ALTER TABLE "Teacher" ADD COLUMN "jwId" INTEGER;
ALTER TABLE "TeacherAssignment" ADD COLUMN "teacherTitleId" INTEGER;

CREATE UNIQUE INDEX "Teacher_jwId_key" ON "Teacher"("jwId");
CREATE INDEX "Teacher_personId_idx" ON "Teacher"("personId");
CREATE INDEX "Teacher_teacherId_idx" ON "Teacher"("teacherId");
CREATE INDEX "TeacherAssignment_teacherTitleId_idx" ON "TeacherAssignment"("teacherTitleId");
ALTER TABLE "TeacherAssignment"
  ADD CONSTRAINT "TeacherAssignment_teacherTitleId_fkey"
  FOREIGN KEY ("teacherTitleId") REFERENCES "TeacherTitle"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
