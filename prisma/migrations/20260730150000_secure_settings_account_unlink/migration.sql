BEGIN;

CREATE FUNCTION public.unlink_settings_account(
  p_user_id text,
  p_provider text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_account_id text;
BEGIN
  IF p_user_id IS NULL OR p_provider IS NULL OR p_provider = '' THEN
    RETURN 'not_linked';
  END IF;

  PERFORM 1
  FROM public."User"
  WHERE "id" = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_linked';
  END IF;

  SELECT "id"
  INTO v_account_id
  FROM public."Account"
  WHERE "userId" = p_user_id AND "provider" = p_provider
  ORDER BY "createdAt", "id"
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN 'not_linked';
  END IF;

  IF (
    SELECT count(*)
    FROM public."Account"
    WHERE "userId" = p_user_id
  ) <= 1 THEN
    RETURN 'last_account';
  END IF;

  DELETE FROM public."Account"
  WHERE "id" = v_account_id AND "userId" = p_user_id;

  DELETE FROM public."VerifiedEmail"
  WHERE "userId" = p_user_id AND "provider" = p_provider;

  RETURN 'unlinked';
END;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.unlink_settings_account(text, text)
  FROM PUBLIC;

COMMIT;
