-- Public profile pages call SECURITY DEFINER helpers. Migrations revoke PUBLIC
-- execute; grant the app runtime role here so production does not depend on a
-- separate manual bootstrap run after each new helper is introduced.

DO $grant_public_profile_functions$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE 'Skipping public profile function grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  IF to_regprocedure(
    'public.get_public_profile_upload_stats(text, timestamp without time zone)'
  ) IS NOT NULL THEN
    EXECUTE $grant_upload_stats$
      GRANT EXECUTE ON FUNCTION
        public.get_public_profile_upload_stats(
          text,
          timestamp without time zone
        )
      TO life_ustc_runtime
    $grant_upload_stats$;
  END IF;

  IF to_regprocedure(
    'public.get_public_profile_homework_completions(text, timestamp without time zone)'
  ) IS NOT NULL THEN
    EXECUTE $grant_homework_completions$
      GRANT EXECUTE ON FUNCTION
        public.get_public_profile_homework_completions(
          text,
          timestamp without time zone
        )
      TO life_ustc_runtime
    $grant_homework_completions$;
  END IF;

  IF to_regprocedure(
    'public.get_public_profile_section_subscription_count(text)'
  ) IS NOT NULL THEN
    EXECUTE $grant_section_subscription_count$
      GRANT EXECUTE ON FUNCTION
        public.get_public_profile_section_subscription_count(text)
      TO life_ustc_runtime
    $grant_section_subscription_count$;
  END IF;
END
$grant_public_profile_functions$;
