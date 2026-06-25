DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CommentAttachment"
    GROUP BY "uploadId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot make CommentAttachment.uploadId unique: at least one upload is attached to multiple comments';
  END IF;
END $$;

ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserSuspension" DROP CONSTRAINT "UserSuspension_createdById_fkey";
ALTER TABLE "UserSuspension" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "UserSuspension"
  ADD CONSTRAINT "UserSuspension_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX "CommentAttachment_uploadId_idx";
CREATE UNIQUE INDEX "CommentAttachment_uploadId_key" ON "CommentAttachment"("uploadId");
