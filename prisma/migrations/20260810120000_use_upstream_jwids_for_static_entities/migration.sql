-- Expand-only: authoritative jwIds are backfilled by a separate snapshot-backed
-- data migration before these columns can become NOT NULL.
ALTER TABLE "Department" ADD COLUMN "jwId" INTEGER;
ALTER TABLE "ExamBatch" ADD COLUMN "jwId" INTEGER;

-- Keep legacy identity constraints throughout expand. The snapshot-backed data
-- migration drops them inside its apply transaction only after planning passes.
DROP INDEX IF EXISTS "Room_buildingId_code_key";
CREATE UNIQUE INDEX "Department_jwId_key" ON "Department"("jwId");
CREATE UNIQUE INDEX "ExamBatch_jwId_key" ON "ExamBatch"("jwId");
CREATE INDEX "Room_buildingId_code_idx" ON "Room"("buildingId", "code");

CREATE TABLE "StaticIdentityMigrationState" (
  "id" TEXT NOT NULL,
  "snapshotSha256" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaticIdentityMigrationState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaticIdentityMigrationState_snapshotSha256_check"
    CHECK ("snapshotSha256" ~ '^[a-f0-9]{64}$')
);
