-- A public reader may reply without UPDATE authority over another author's row.
-- The narrowly scoped helper acquires the existing moderation-conflicting lock
-- and returns only its ID; the subsequent read still uses the caller's RLS role.
CREATE FUNCTION public.lock_comment_reply_parent(p_comment_id text)
RETURNS TABLE (id text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET app.comment_reply_lock = 'on'
AS $function$
  SELECT parent."id"
  FROM public."Comment" AS parent
  WHERE parent."id" = p_comment_id
    AND EXISTS (
      SELECT 1 FROM public."User" AS actor
      WHERE actor."id" = NULLIF(current_setting('app.user_id', true), '')
        AND NOT EXISTS (
          SELECT 1 FROM public."UserSuspension" AS suspension
          WHERE suspension."userId" = actor."id"
            AND suspension."liftedAt" IS NULL
            AND (suspension."expiresAt" IS NULL OR suspension."expiresAt" > CURRENT_TIMESTAMP)
        )
    )
    AND (
      parent."status" = 'active'
      OR parent."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  FOR UPDATE OF parent;
$function$;

REVOKE ALL ON FUNCTION public.lock_comment_reply_parent(text) FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    GRANT UPDATE ("id") ON TABLE public."Comment" TO life_ustc_function_owner;
    CREATE POLICY "Comment_reply_parent_lock" ON public."Comment"
      FOR UPDATE TO life_ustc_function_owner
      USING (current_setting('app.comment_reply_lock', true) = 'on')
      WITH CHECK (false);
    ALTER FUNCTION public.lock_comment_reply_parent(text) OWNER TO life_ustc_function_owner;
    REVOKE EXECUTE ON FUNCTION public.lock_comment_reply_parent(text) FROM life_ustc_function_owner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.lock_comment_reply_parent(text) TO life_ustc_runtime;
  END IF;
END
$grants$;
