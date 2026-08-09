-- Expand-only: authoritative jwIds are backfilled by a separate snapshot-backed
-- data migration before these columns can become NOT NULL.
ALTER TABLE "Department" ADD COLUMN "jwId" INTEGER;
ALTER TABLE "ExamBatch" ADD COLUMN "jwId" INTEGER;

CREATE UNIQUE INDEX "Department_jwId_key" ON "Department"("jwId");
CREATE UNIQUE INDEX "ExamBatch_jwId_key" ON "ExamBatch"("jwId");
