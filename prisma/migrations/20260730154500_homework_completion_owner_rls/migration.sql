BEGIN;

ALTER TABLE "HomeworkCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomeworkCompletion" FORCE ROW LEVEL SECURITY;

CREATE POLICY "HomeworkCompletion_owner_isolation" ON "HomeworkCompletion"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

-- FORCE RLS also applies to a non-BYPASSRLS table owner. This policy is bound
-- to the migration owner and activated only by the public profile function.
CREATE POLICY "HomeworkCompletion_profile_reader" ON "HomeworkCompletion"
  FOR SELECT
  TO CURRENT_USER
  USING (
    current_setting('app.homework_completion_profile', true) = 'on'
  );

-- Public profiles expose completion activity in their contribution heatmap.
-- Return only the completion timestamp instead of granting cross-owner access
-- to HomeworkCompletion rows.
CREATE FUNCTION public.get_public_profile_homework_completions(
  p_user_id text,
  p_since timestamp(3) without time zone
)
RETURNS TABLE (
  "completedAt" timestamp(3) without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
SET app.homework_completion_profile = 'on'
AS $function$
  SELECT completion."completedAt"
  FROM public."HomeworkCompletion" AS completion
  WHERE completion."userId" = p_user_id
    AND completion."completedAt" >= p_since
  ORDER BY completion."completedAt";
$function$;

REVOKE ALL
  ON FUNCTION public.get_public_profile_homework_completions(
    text,
    timestamp without time zone
  )
  FROM PUBLIC;

COMMIT;
