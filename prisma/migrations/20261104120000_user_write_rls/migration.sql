BEGIN;

-- Application preparation must be deployed before this migration. Existing
-- read projections and column grants remain; this step protects User writes.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" FORCE ROW LEVEL SECURITY;
CREATE POLICY "User_existing_reads" ON public."User" FOR SELECT USING (true);
CREATE POLICY "User_auth_insert" ON public."User" FOR INSERT
  WITH CHECK (current_user = 'life_ustc_auth_runtime');
CREATE POLICY "User_service_update" ON public."User" FOR UPDATE
  USING (current_user IN ('life_ustc_auth_runtime', 'life_ustc_function_owner'));
CREATE POLICY "User_account_delete" ON public."User" FOR DELETE
  USING (current_user = 'life_ustc_function_owner');
CREATE POLICY "User_actor_update" ON public."User" FOR UPDATE USING (
  current_user = 'life_ustc_runtime' AND (
    id = NULLIF(current_setting('app.user_id', true), '')
    OR EXISTS (
      SELECT 1 FROM public."User" AS actor
      WHERE actor.id = NULLIF(current_setting('app.user_id', true), '')
        AND actor."isAdmin"
    )
  )
);

-- RLS limits target rows. OLD/NEW checks additionally separate personal fields
-- from admin fields without granting the auth role new application privileges.
CREATE FUNCTION public.enforce_user_app_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  actor_id text := NULLIF(current_setting('app.user_id', true), '');
  actor_admin boolean;
BEGIN
  IF current_user <> 'life_ustc_runtime' THEN
    RETURN NEW;
  END IF;
  SELECT actor."isAdmin" AND NOT EXISTS (
    SELECT 1 FROM public."UserSuspension" AS suspension
    WHERE suspension."userId" = actor.id AND suspension."liftedAt" IS NULL
      AND (suspension."expiresAt" IS NULL OR suspension."expiresAt" > (statement_timestamp() AT TIME ZONE 'UTC'))
  ) INTO actor_admin
  FROM public."User" AS actor WHERE actor.id = actor_id;
  IF actor_id IS NULL OR actor_admin IS NULL THEN
    RAISE EXCEPTION 'User update requires an existing actor' USING ERRCODE = '42501';
  END IF;
  IF OLD.id <> actor_id AND NOT actor_admin THEN
    RAISE EXCEPTION 'User governance requires an active administrator' USING ERRCODE = '42501';
  END IF;
  IF NEW."isAdmin" IS DISTINCT FROM OLD."isAdmin"
     AND (NOT actor_admin OR OLD.id = actor_id) THEN
    RAISE EXCEPTION 'Only another administrator can change a user role' USING ERRCODE = '42501';
  END IF;
  IF OLD.id <> actor_id AND (
    NEW."profilePictures" IS DISTINCT FROM OLD."profilePictures"
    OR NEW."calendarFeedToken" IS DISTINCT FROM OLD."calendarFeedToken"
  ) THEN
    RAISE EXCEPTION 'Personal User fields require their owner' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_user_app_update() FROM PUBLIC;
CREATE TRIGGER enforce_user_app_update BEFORE UPDATE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_app_update();

COMMIT;
