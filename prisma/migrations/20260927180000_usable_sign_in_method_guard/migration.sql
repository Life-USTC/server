BEGIN;

DROP FUNCTION public.unlink_settings_account(text, text);

CREATE FUNCTION public.remove_sign_in_method(
  p_user_id text,
  p_kind text,
  p_key text,
  p_enabled_providers jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id text;
  v_provider text;
BEGIN
  IF p_user_id IS NULL OR p_key IS NULL OR p_key = ''
    OR p_kind IS NULL OR p_kind NOT IN ('provider', 'account', 'passkey') THEN
    RETURN 'not_linked';
  END IF;

  -- All provider and passkey removals take the same lock before checking the
  -- remaining methods, so concurrent removals cannot strand an account.
  PERFORM 1 FROM public."User" WHERE "id" = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_linked'; END IF;

  IF p_kind = 'passkey' THEN
    SELECT "id" INTO v_id FROM public."Passkey"
      WHERE "userId" = p_user_id AND "id" = p_key;
  ELSE
    SELECT "id", "provider" INTO v_id, v_provider FROM public."Account"
      WHERE "userId" = p_user_id AND
        ((p_kind = 'account' AND "id" = p_key) OR
         (p_kind = 'provider' AND "provider" = p_key))
      ORDER BY "createdAt", "id" LIMIT 1;
  END IF;
  IF v_id IS NULL THEN RETURN 'not_linked'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."Account"
    WHERE "userId" = p_user_id
      AND (p_kind = 'passkey' OR "id" <> v_id)
      AND "issuer" = p_enabled_providers ->> "provider"
      AND ("provider" <> 'credential' OR
        (COALESCE("password", '') <> '' AND "providerAccountId" = p_user_id))
  ) AND NOT EXISTS (
    SELECT 1 FROM public."Passkey"
    WHERE "userId" = p_user_id AND (p_kind <> 'passkey' OR "id" <> v_id)
  ) THEN
    RETURN 'last_account';
  END IF;

  IF p_kind = 'passkey' THEN
    DELETE FROM public."Passkey" WHERE "id" = v_id AND "userId" = p_user_id;
  ELSE
    DELETE FROM public."Account" WHERE "id" = v_id AND "userId" = p_user_id;
    IF NOT EXISTS (
      SELECT 1 FROM public."Account" WHERE "userId" = p_user_id AND "provider" = v_provider
    ) THEN
      DELETE FROM public."VerifiedEmail" WHERE "userId" = p_user_id AND "provider" = v_provider;
    END IF;
  END IF;
  RETURN 'unlinked';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.remove_sign_in_method(text, text, text, jsonb) FROM PUBLIC;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    GRANT SELECT, DELETE ON TABLE public."Passkey" TO life_ustc_function_owner;
    ALTER FUNCTION public.remove_sign_in_method(text, text, text, jsonb) OWNER TO life_ustc_function_owner;
    REVOKE EXECUTE ON FUNCTION public.remove_sign_in_method(text, text, text, jsonb) FROM life_ustc_function_owner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'life_ustc_auth_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.remove_sign_in_method(text, text, text, jsonb) TO life_ustc_auth_runtime;
  END IF;
END;
$roles$;
COMMIT;
