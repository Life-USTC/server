-- OAuth hooks and profile completion append trusted, server-derived avatar
-- URLs. Keep Better Auth's role read-only for this field; only the app runtime
-- receives the narrow column-level write privilege.

DO $grant_profile_picture_app_runtime$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
  ) THEN
    RAISE NOTICE 'Skipping profilePictures grant; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  EXECUTE
    'GRANT UPDATE ("profilePictures") ON TABLE "User" TO life_ustc_runtime';
END
$grant_profile_picture_app_runtime$;
