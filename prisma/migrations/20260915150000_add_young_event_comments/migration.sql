ALTER TABLE "Comment"
  ADD COLUMN "youngEventId" INTEGER;

CREATE INDEX "Comment_youngEventId_idx"
  ON "Comment"("youngEventId");

CREATE INDEX "Comment_youngEventId_status_idx"
  ON "Comment"("youngEventId", "status");

ALTER TABLE "Comment"
  DROP CONSTRAINT "Comment_exactly_one_target";

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_exactly_one_target"
  CHECK (
    num_nonnulls(
      "sectionId",
      "courseId",
      "teacherId",
      "sectionTeacherId",
      "homeworkId",
      "youngEventId"
    ) = 1
  );

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_youngEventId_fkey"
  FOREIGN KEY ("youngEventId") REFERENCES "YoungEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The production roles bootstrap transfers this helper to
-- `life_ustc_function_owner`. A migrator that does not own the old overload
-- cannot drop it, but it can still add the six-argument overload used by the
-- application. Drop the obsolete overload only when the current migration
-- role owns it; otherwise leave its privileges and ownership untouched.
DO $do$
BEGIN
  IF to_regprocedure(
    'public.comment_hidden_root_count(integer, integer, integer, text, integer)'
  ) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'comment_hidden_root_count'
      AND p.oid = to_regprocedure(
        'public.comment_hidden_root_count(integer, integer, integer, text, integer)'
      )
      AND pg_get_userbyid(p.proowner) = current_user
  ) THEN
    DROP FUNCTION public.comment_hidden_root_count(
      integer,
      integer,
      integer,
      text,
      integer
    );
  END IF;
END
$do$;

CREATE FUNCTION public.comment_hidden_root_count(
  p_section_id integer DEFAULT NULL,
  p_course_id integer DEFAULT NULL,
  p_teacher_id integer DEFAULT NULL,
  p_homework_id text DEFAULT NULL,
  p_section_teacher_id integer DEFAULT NULL,
  p_young_event_id integer DEFAULT NULL
) RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COUNT(*)::bigint
  FROM public."Comment"
  WHERE "parentId" IS NULL
    AND "status" = 'active'
    AND "visibility" = 'logged_in_only'
    AND (
      (p_section_id IS NOT NULL AND "sectionId" = p_section_id)
      OR (p_course_id IS NOT NULL AND "courseId" = p_course_id)
      OR (p_teacher_id IS NOT NULL AND "teacherId" = p_teacher_id)
      OR (p_homework_id IS NOT NULL AND "homeworkId" = p_homework_id)
      OR (p_section_teacher_id IS NOT NULL
          AND "sectionTeacherId" = p_section_teacher_id)
      OR (p_young_event_id IS NOT NULL AND "youngEventId" = p_young_event_id)
    );
$function$;
