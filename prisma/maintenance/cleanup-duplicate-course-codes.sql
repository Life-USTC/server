\echo 'Usage: psql "$DATABASE_URL" -f prisma/maintenance/cleanup-duplicate-course-codes.sql'
\echo 'Apply: psql "$DATABASE_URL" -v apply=true -f prisma/maintenance/cleanup-duplicate-course-codes.sql'
\echo 'Scope: merges legacy duplicate Course rows into code-based synthetic Course rows when core metadata is unchanged.'

\set ON_ERROR_STOP on

\if :{?apply}
\else
\set apply false
\endif

\echo 'cleanup-duplicate-course-codes: apply=' :apply

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

\if :apply
LOCK TABLE "Course", "Section", "Description", "Comment" IN SHARE ROW EXCLUSIVE MODE;
\endif

CREATE TEMP TABLE course_code_cleanup_candidates ON COMMIT DROP AS
WITH duplicate_codes AS (
  SELECT
    "code",
    count(*) AS course_count,
    count(*) FILTER (
      WHERE "jwId" BETWEEN 1500000000 AND 1899999999
    ) AS synthetic_count
  FROM "Course"
  GROUP BY "code"
  HAVING count(*) > 1
),
canonical_courses AS (
  SELECT c.*
  FROM "Course" c
  JOIN duplicate_codes d ON d."code" = c."code"
  WHERE d.synthetic_count = 1
    AND c."jwId" BETWEEN 1500000000 AND 1899999999
),
legacy_courses AS (
  SELECT
    canonical."code",
    canonical.id AS canonical_course_id,
    canonical."jwId" AS canonical_jw_id,
    canonical."classifyId" AS canonical_classify_id,
    legacy.id AS legacy_course_id,
    legacy."jwId" AS legacy_jw_id,
    legacy."classifyId" AS legacy_classify_id,
    (
      legacy."nameCn" IS NOT DISTINCT FROM canonical."nameCn"
      AND legacy."nameEn" IS NOT DISTINCT FROM canonical."nameEn"
      AND legacy."categoryId" IS NOT DISTINCT FROM canonical."categoryId"
      AND legacy."classTypeId" IS NOT DISTINCT FROM canonical."classTypeId"
      AND legacy."educationLevelId" IS NOT DISTINCT FROM canonical."educationLevelId"
      AND legacy."gradationId" IS NOT DISTINCT FROM canonical."gradationId"
      AND legacy."typeId" IS NOT DISTINCT FROM canonical."typeId"
    ) AS core_metadata_matches,
    (
      SELECT count(*)::int
      FROM "Section" s
      WHERE s."courseId" = legacy.id
    ) AS legacy_section_count,
    (
      SELECT count(*)::int
      FROM "Comment" cm
      WHERE cm."courseId" = legacy.id
    ) AS legacy_comment_count,
    (
      SELECT count(*)::int
      FROM "Description" d
      WHERE d."courseId" = legacy.id
    ) AS legacy_description_count,
    (
      SELECT count(*)::int
      FROM "Description" d
      WHERE d."courseId" = canonical.id
    ) AS canonical_description_count
  FROM canonical_courses canonical
  JOIN "Course" legacy
    ON legacy."code" = canonical."code"
   AND legacy.id <> canonical.id
)
SELECT *
FROM legacy_courses;

CREATE TEMP TABLE course_code_cleanup_group_status ON COMMIT DROP AS
SELECT
  canonical_course_id,
  "code",
  bool_and(core_metadata_matches) AS core_metadata_matches,
  max(canonical_description_count) AS canonical_description_count,
  sum(legacy_description_count) AS legacy_description_count,
  max(canonical_classify_id) AS canonical_classify_id,
  min(legacy_classify_id) FILTER (
    WHERE legacy_classify_id IS NOT NULL
  ) AS merged_legacy_classify_id,
  count(DISTINCT legacy_classify_id) FILTER (
    WHERE legacy_classify_id IS NOT NULL
  ) AS legacy_classify_variant_count,
  bool_or(
    canonical_classify_id IS NOT NULL
    AND legacy_classify_id IS NOT NULL
    AND canonical_classify_id <> legacy_classify_id
  ) AS classify_conflicts
FROM course_code_cleanup_candidates
GROUP BY canonical_course_id, "code";

CREATE TEMP TABLE course_code_cleanup_safe ON COMMIT DROP AS
SELECT
  candidate.*,
  status.merged_legacy_classify_id
FROM course_code_cleanup_candidates candidate
JOIN course_code_cleanup_group_status status
  ON status.canonical_course_id = candidate.canonical_course_id
WHERE status.core_metadata_matches
  AND status.legacy_description_count <= 1
  AND NOT (
    status.legacy_description_count = 1
    AND status.canonical_description_count > 0
  )
  AND status.legacy_classify_variant_count <= 1
  AND NOT status.classify_conflicts;

CREATE TEMP TABLE course_code_cleanup_conflicts ON COMMIT DROP AS
SELECT
  candidate.*,
  CASE
    WHEN NOT status.core_metadata_matches THEN 'core_metadata_mismatch'
    WHEN status.legacy_description_count > 1 THEN 'multiple_legacy_descriptions'
    WHEN status.legacy_description_count = 1
      AND status.canonical_description_count > 0 THEN 'description_conflict'
    WHEN status.legacy_classify_variant_count > 1
      OR status.classify_conflicts THEN 'classify_conflict'
    ELSE 'unknown'
  END AS reason
FROM course_code_cleanup_candidates candidate
JOIN course_code_cleanup_group_status status
  ON status.canonical_course_id = candidate.canonical_course_id
WHERE NOT EXISTS (
  SELECT 1
  FROM course_code_cleanup_safe safe
  WHERE safe.legacy_course_id = candidate.legacy_course_id
);

\echo 'candidate summary'
SELECT
  (SELECT count(DISTINCT "code") FROM course_code_cleanup_candidates) AS candidate_codes,
  (SELECT count(*) FROM course_code_cleanup_candidates) AS candidate_legacy_courses,
  (SELECT count(DISTINCT "code") FROM course_code_cleanup_safe) AS safe_codes,
  (SELECT count(*) FROM course_code_cleanup_safe) AS safe_legacy_courses,
  (SELECT count(DISTINCT "code") FROM course_code_cleanup_conflicts) AS conflict_codes,
  (SELECT count(*) FROM course_code_cleanup_conflicts) AS conflict_legacy_courses;

\echo 'planned reference moves'
SELECT
  coalesce(sum(legacy_section_count), 0)::int AS sections_to_move,
  coalesce(sum(legacy_comment_count), 0)::int AS comments_to_move,
  coalesce(sum(legacy_description_count), 0)::int AS descriptions_to_move,
  count(DISTINCT canonical_course_id) FILTER (
    WHERE merged_legacy_classify_id IS NOT NULL
  )::int AS canonical_classify_updates
FROM course_code_cleanup_safe;

\echo 'conflict reasons'
SELECT reason, count(DISTINCT "code") AS codes, count(*) AS legacy_courses
FROM course_code_cleanup_conflicts
GROUP BY reason
ORDER BY reason;

\echo 'first conflicts'
SELECT
  "code",
  reason,
  canonical_jw_id,
  legacy_jw_id,
  legacy_section_count,
  legacy_comment_count,
  legacy_description_count,
  canonical_description_count
FROM course_code_cleanup_conflicts
ORDER BY "code", legacy_jw_id
LIMIT 50;

\if :apply

\echo 'applying cleanup'

WITH classify_updates AS (
  UPDATE "Course" course
  SET "classifyId" = grouped.merged_legacy_classify_id
  FROM (
    SELECT
      canonical_course_id,
      max(merged_legacy_classify_id) AS merged_legacy_classify_id
    FROM course_code_cleanup_safe
    WHERE merged_legacy_classify_id IS NOT NULL
    GROUP BY canonical_course_id
  ) grouped
  WHERE course.id = grouped.canonical_course_id
    AND course."classifyId" IS NULL
  RETURNING course.id
)
SELECT count(*) AS canonical_classify_updated
FROM classify_updates;

WITH moved_descriptions AS (
  UPDATE "Description" description
  SET "courseId" = safe.canonical_course_id
  FROM course_code_cleanup_safe safe
  WHERE description."courseId" = safe.legacy_course_id
  RETURNING description.id
)
SELECT count(*) AS descriptions_moved
FROM moved_descriptions;

WITH moved_comments AS (
  UPDATE "Comment" comment
  SET "courseId" = safe.canonical_course_id
  FROM course_code_cleanup_safe safe
  WHERE comment."courseId" = safe.legacy_course_id
  RETURNING comment.id
)
SELECT count(*) AS comments_moved
FROM moved_comments;

WITH moved_sections AS (
  UPDATE "Section" section
  SET "courseId" = safe.canonical_course_id
  FROM course_code_cleanup_safe safe
  WHERE section."courseId" = safe.legacy_course_id
  RETURNING section.id
)
SELECT count(*) AS sections_moved
FROM moved_sections;

WITH deleted_courses AS (
  DELETE FROM "Course" course
  USING course_code_cleanup_safe safe
  WHERE course.id = safe.legacy_course_id
  RETURNING course.id
)
SELECT count(*) AS legacy_courses_deleted
FROM deleted_courses;

\echo 'remaining duplicate course codes after cleanup'
SELECT count(*) AS duplicate_code_groups
FROM (
  SELECT "code"
  FROM "Course"
  GROUP BY "code"
  HAVING count(*) > 1
) duplicate_codes;

COMMIT;

\else

\echo 'dry run only; no changes committed. Re-run with -v apply=true to apply.'
ROLLBACK;

\endif
