DO $$
DECLARE
  duplicate_uploads integer;
  duplicate_links integer;
BEGIN
  SELECT
    COUNT(*)::integer,
    COALESCE(SUM("attachmentCount" - 1), 0)::integer
  INTO duplicate_uploads, duplicate_links
  FROM (
    SELECT "uploadId", COUNT(*) AS "attachmentCount"
    FROM "CommentAttachment"
    GROUP BY "uploadId"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_uploads > 0 THEN
    RAISE EXCEPTION
      'Cannot add CommentAttachment_uploadId_key: found % uploads linked to multiple comments (% duplicate links). Resolve duplicate CommentAttachment rows explicitly before applying this migration.',
      duplicate_uploads,
      duplicate_links;
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
DROP INDEX "CommentAttachment_commentId_uploadId_key";
CREATE UNIQUE INDEX "CommentAttachment_uploadId_key" ON "CommentAttachment"("uploadId");
