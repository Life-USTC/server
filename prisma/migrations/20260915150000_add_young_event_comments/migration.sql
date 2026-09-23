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

-- Replace the former signature; every application caller now passes six targets.
DROP FUNCTION public.comment_hidden_root_count(integer, integer, integer, text, integer);

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

REVOKE ALL ON FUNCTION public.comment_hidden_root_count(integer, integer, integer, text, integer, integer) FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    ALTER FUNCTION public.comment_hidden_root_count(integer, integer, integer, text, integer, integer) OWNER TO life_ustc_function_owner;
    REVOKE EXECUTE ON FUNCTION public.comment_hidden_root_count(integer, integer, integer, text, integer, integer) FROM life_ustc_function_owner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.comment_hidden_root_count(integer, integer, integer, text, integer, integer) TO life_ustc_runtime;
  END IF;
END
$grants$;
