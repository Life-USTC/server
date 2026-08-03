BEGIN;

-- `20260801120000_comment_collaborative_rls` was applied in some environments
-- from a revision that did not yet contain this function, so this migration
-- cannot assume it exists. Create it when missing and leave an existing one
-- alone: once the roles bootstrap has run, the function is owned by
-- `life_ustc_function_owner` and the migrator may no longer replace it.
-- Keep the body in sync with 20260801120000.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'comment_hidden_root_count'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.comment_hidden_root_count(
        p_section_id integer DEFAULT NULL,
        p_course_id integer DEFAULT NULL,
        p_teacher_id integer DEFAULT NULL,
        p_homework_id text DEFAULT NULL,
        p_section_teacher_id integer DEFAULT NULL
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
          );
      $function$;
    $fn$;
  END IF;
END
$do$;

-- FORCE RLS applies to the definer too, and no other policy exposes
-- `logged_in_only` rows, so the definer needs its own SELECT policy. The roles
-- bootstrap re-binds this policy to `life_ustc_function_owner`; before it runs
-- the migrator is the only role that executes the function.
DROP POLICY IF EXISTS "Comment_hidden_count_reader" ON "Comment";
CREATE POLICY "Comment_hidden_count_reader" ON "Comment"
  FOR SELECT
  TO CURRENT_USER
  USING (true);

-- Only the function owner may change its privileges, and after the bootstrap
-- that is `life_ustc_function_owner` rather than the migrator.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'comment_hidden_root_count'
      AND pg_get_userbyid(p.proowner) = current_user
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.comment_hidden_root_count('
      || 'integer, integer, integer, text, integer'
      || ') FROM PUBLIC';

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.comment_hidden_root_count('
        || 'integer, integer, integer, text, integer'
        || ') TO life_ustc_runtime';
    END IF;
  END IF;
END
$do$;

COMMIT;
