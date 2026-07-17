ALTER TYPE "AuditAction" ADD VALUE 'section_retire';
ALTER TYPE "AuditAction" ADD VALUE 'section_reactivate';

ALTER TABLE "Section"
ADD COLUMN "sourceLastSeenAt" TIMESTAMP(3),
ADD COLUMN "retiredAt" TIMESTAMP(3);

CREATE INDEX "Section_semesterId_retiredAt_idx"
ON "Section"("semesterId", "retiredAt");
