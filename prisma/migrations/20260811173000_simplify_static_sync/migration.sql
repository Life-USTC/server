-- The raw-jwId migration has completed. Static sync now owns the current
-- upstream identity directly and applies Section presence in the same run.
ALTER TABLE "Teacher" DROP COLUMN "teacherId";
ALTER TABLE "Teacher" ALTER COLUMN "jwId" SET NOT NULL;
ALTER TABLE "Campus" ALTER COLUMN "jwId" SET NOT NULL;
ALTER TABLE "AdminClass" ALTER COLUMN "jwId" SET NOT NULL;
ALTER TABLE "ExamBatch" ALTER COLUMN "jwId" SET NOT NULL;

-- These constraints predate upstream IDs and contradict the current Prisma
-- schema. Different upstream records may legitimately share display values.
DROP INDEX IF EXISTS "AdminClass_nameCn_key";
DROP INDEX IF EXISTS "Campus_nameCn_key";
DROP INDEX IF EXISTS "Department_code_key";
DROP INDEX IF EXISTS "ExamBatch_nameCn_key";
DROP INDEX IF EXISTS "Teacher_personId_key";
DROP INDEX IF EXISTS "Teacher_code_key";
DROP INDEX IF EXISTS "TeacherTitle_nameCn_key";

ALTER TABLE "Section" DROP COLUMN "sourceLastSeenAt";
DROP TABLE "StaticIdentityMigrationState";

-- Existing rows were imported before missing Sections were handled
-- automatically. Force one complete pass with the current snapshot.
DELETE FROM "StaticImportState";
