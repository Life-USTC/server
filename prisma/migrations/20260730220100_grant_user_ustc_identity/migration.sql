-- Grant explicit USTC identity table access to the app runtime role.

DO $grant_user_ustc_identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE 'Skipping UserUstcIdentity grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  EXECUTE
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "UserUstcIdentity" TO life_ustc_runtime';
END
$grant_user_ustc_identity$;
