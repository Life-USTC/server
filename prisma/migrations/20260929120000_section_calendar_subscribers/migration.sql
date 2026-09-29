BEGIN;

-- The queue has no user identity. Expose only the recipient IDs for one section
-- through the maintenance role; ordinary subscription access remains owner RLS.
CREATE FUNCTION public.list_section_calendar_subscribers(
  p_section_id integer,
  p_after_user_id text,
  p_batch_size integer
)
RETURNS TABLE ("userId" text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT subscription."userId"
  FROM public."UserSectionSubscription" AS subscription
  WHERE subscription."sectionId" = p_section_id
    AND (p_after_user_id IS NULL OR subscription."userId" > p_after_user_id)
  ORDER BY subscription."userId"
  LIMIT LEAST(GREATEST(p_batch_size, 1), 100);
$function$;

REVOKE ALL ON FUNCTION public.list_section_calendar_subscribers(integer, text, integer) FROM PUBLIC;
-- The public profile subscription projection was removed. Its unrestricted
-- table grant and misleading policy name must not outlive that capability.
DROP POLICY IF EXISTS "UserSectionSubscription_profile_reader" ON public."UserSectionSubscription";

DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    REVOKE SELECT ON public."UserSectionSubscription" FROM life_ustc_function_owner;
    GRANT SELECT ("userId", "sectionId") ON public."UserSectionSubscription" TO life_ustc_function_owner;
    CREATE POLICY "UserSectionSubscription_calendar_recipients"
      ON public."UserSectionSubscription" FOR SELECT TO life_ustc_function_owner USING (true);
    ALTER FUNCTION public.list_section_calendar_subscribers(integer, text, integer) OWNER TO life_ustc_function_owner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'life_ustc_maintenance_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.list_section_calendar_subscribers(integer, text, integer) TO life_ustc_maintenance_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    REVOKE EXECUTE ON FUNCTION public.list_section_calendar_subscribers(integer, text, integer) FROM life_ustc_function_owner;
  END IF;
END
$grants$;

COMMIT;
