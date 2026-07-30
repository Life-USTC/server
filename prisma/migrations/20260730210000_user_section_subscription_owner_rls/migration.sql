BEGIN;

ALTER TABLE "UserSectionSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSectionSubscription" FORCE ROW LEVEL SECURITY;

CREATE POLICY "UserSectionSubscription_owner_isolation" ON "UserSectionSubscription"
  FOR ALL
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

CREATE FUNCTION public.get_public_profile_section_subscription_count(
  p_user_id text
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT count(*)::bigint
  FROM public."UserSectionSubscription"
  WHERE "userId" = p_user_id;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.get_public_profile_section_subscription_count(text)
  FROM PUBLIC;

COMMIT;
