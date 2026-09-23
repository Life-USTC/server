-- Per-key upload lifecycle leases for PUT/completion coordination (#571).

CREATE TYPE "UploadPendingPhase" AS ENUM (
  'reserved',
  'uploading',
  'uploaded',
  'completing',
  'cleaning'
);

ALTER TABLE "UploadPending"
  ADD COLUMN "attemptId" TEXT,
  ADD COLUMN "phase" "UploadPendingPhase" NOT NULL DEFAULT 'reserved',
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

UPDATE "UploadPending"
SET "attemptId" = "id"
WHERE "attemptId" IS NULL;

ALTER TABLE "UploadPending"
  ALTER COLUMN "attemptId" SET NOT NULL;

CREATE INDEX "UploadPending_phase_leaseExpiresAt_idx"
  ON "UploadPending"("phase", "leaseExpiresAt");
