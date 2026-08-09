-- Expand-only: authoritative jwIds are backfilled by a separate snapshot-backed
-- data migration before these columns can become NOT NULL.
ALTER TABLE "Department" ADD COLUMN "jwId" INTEGER;
ALTER TABLE "ExamBatch" ADD COLUMN "jwId" INTEGER;

DROP INDEX IF EXISTS "AdminClass_nameCn_key";
DROP INDEX IF EXISTS "Department_code_key";
DROP INDEX IF EXISTS "ExamBatch_nameCn_key";
DROP INDEX IF EXISTS "TeacherTitle_nameCn_key";
DROP INDEX IF EXISTS "Room_buildingId_code_key";

CREATE UNIQUE INDEX "Department_jwId_key" ON "Department"("jwId");
CREATE UNIQUE INDEX "ExamBatch_jwId_key" ON "ExamBatch"("jwId");
CREATE INDEX "Room_buildingId_code_idx" ON "Room"("buildingId", "code");
