-- Index hygiene: restore the CommentAttachment."commentId" lookup index, and
-- drop indexes that exactly duplicate a unique index on the same table.
--
-- Runner behaviour (measured against prisma 7.10.1 `migrate deploy`): a
-- migration script containing `CREATE INDEX CONCURRENTLY` is executed statement
-- by statement with autocommit, so each statement below commits on its own and
-- `CREATE INDEX CONCURRENTLY` is legal here (as in
-- 20260718170000_add_session_expiry_index and
-- 20260917000000_add_publication_fold_columns). `DROP INDEX CONCURRENTLY` is
-- *not* usable: the runner's SQL parser does not recognise CONCURRENTLY on DROP
-- INDEX and silently falls back to wrapping the whole script in a transaction,
-- which then fails with 25001. Plain `DROP INDEX` is used instead.
--
-- Because each DROP commits on its own, it holds ACCESS EXCLUSIVE on one table
-- at a time rather than on all of them until the end of the migration. The
-- lock_timeout bounds the only remaining production risk -- a DROP queueing
-- behind a long-running read and stalling new queries on that table -- to a few
-- seconds. Every DROP is `IF EXISTS`, so re-running the migration after such a
-- timeout is safe; the non-idempotent CREATE is therefore kept last.
SET lock_timeout = '3s';

-- Each index below has the same access method (btree), the same key columns in
-- the same order, the same operator class, the same collation, the same
-- ASC/NULLS ordering, no INCLUDE columns and no partial predicate as the `_key`
-- unique index that Prisma creates for the corresponding `@unique` /
-- `@@unique`. A unique btree index serves every read a plain btree index on the
-- same key can serve -- equality, `= ANY(...)`, range, ordered and index-only
-- scans, forwards and backwards -- so the plain copy only adds per-row write
-- and vacuum cost, most of it on the nightly JW bulk import. None of these
-- indexes backs a constraint and none of these tables uses REPLICA IDENTITY
-- USING INDEX, so nothing except the planner can reference them.
DROP INDEX IF EXISTS "AdminClass_jwId_idx";
DROP INDEX IF EXISTS "Building_jwId_idx";
DROP INDEX IF EXISTS "BusCampus_nameCn_idx";
DROP INDEX IF EXISTS "Campus_jwId_idx";
DROP INDEX IF EXISTS "ClassType_nameCn_idx";
DROP INDEX IF EXISTS "Course_jwId_idx";
DROP INDEX IF EXISTS "CourseCategory_nameCn_idx";
DROP INDEX IF EXISTS "CourseClassify_nameCn_idx";
DROP INDEX IF EXISTS "CourseGradation_nameCn_idx";
DROP INDEX IF EXISTS "CourseType_nameCn_idx";
DROP INDEX IF EXISTS "Description_homeworkId_idx";
DROP INDEX IF EXISTS "DeviceCode_deviceCode_idx";
DROP INDEX IF EXISTS "DeviceCode_userCode_idx";
DROP INDEX IF EXISTS "EducationLevel_nameCn_idx";
DROP INDEX IF EXISTS "Exam_jwId_idx";
DROP INDEX IF EXISTS "ExamMode_nameCn_idx";
DROP INDEX IF EXISTS "Publication_currentRevisionId_idx";
DROP INDEX IF EXISTS "Room_jwId_idx";
DROP INDEX IF EXISTS "RoomType_jwId_idx";
DROP INDEX IF EXISTS "ScheduleGroup_jwId_idx";
DROP INDEX IF EXISTS "Section_jwId_idx";
DROP INDEX IF EXISTS "Semester_jwId_idx";
DROP INDEX IF EXISTS "TeachLanguage_nameCn_idx";
DROP INDEX IF EXISTS "TeacherLessonType_jwId_idx";
DROP INDEX IF EXISTS "TeacherTitle_jwId_idx";
DROP INDEX IF EXISTS "WeatherObservation_locationKey_observedAt_idx";

-- Teacher declared both `jwId Int @unique` and `@@index([jwId])`, but no
-- migration ever created "Teacher_jwId_idx" -- the declaration was pure
-- schema/database drift, which removing the `@@index` from schema.prisma
-- resolves. This guard keeps the two in sync on any database where the index
-- was created by hand.
DROP INDEX IF EXISTS "Teacher_jwId_idx";

-- Restore an index on CommentAttachment."commentId".
--
-- public.comment_attachment_summaries(text[]) filters
-- `attachment."commentId" = ANY(p_comment_ids)` and runs on every
-- community_comment_list / community_comment_get / /api/community/comments /
-- thread / replies request (src/features/comments/server/comment-read-metadata.ts),
-- with up to ~1100 ids per call (pageSize 100 x reply preview 11).
--
-- 20260124121150_add_comments created "CommentAttachment_commentId_uploadId_key",
-- whose leading column served that lookup.
-- 20260625140000_fix_collaborative_invariants replaced it with a uploadId-only
-- unique to enforce the 1:1 upload invariant and added nothing back on
-- commentId, leaving the table with only CommentAttachment_pkey(id) and
-- CommentAttachment_uploadId_key(uploadId). Every attachment lookup has been a
-- sequential scan since. See the PR body for EXPLAIN (ANALYZE) evidence.
SET lock_timeout = 0;

CREATE INDEX CONCURRENTLY "CommentAttachment_commentId_idx"
ON "CommentAttachment"("commentId");
