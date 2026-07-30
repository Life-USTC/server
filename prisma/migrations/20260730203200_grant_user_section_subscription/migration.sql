-- Grant explicit section subscription table access to the app runtime role.

DO $grant_user_section_subscription$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE 'Skipping UserSectionSubscription grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  EXECUTE
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "UserSectionSubscription" TO life_ustc_runtime';
END
$grant_user_section_subscription$;
