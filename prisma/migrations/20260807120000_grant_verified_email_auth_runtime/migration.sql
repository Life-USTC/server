-- Auth runtime needs VerifiedEmail to persist GitHub/Google mailboxes and to
-- resolve OAuth userinfo without returning @users.local placeholders.

DO $grant_verified_email_auth_runtime$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime'
  ) THEN
    RAISE NOTICE 'Skipping VerifiedEmail grants; role life_ustc_auth_runtime does not exist.';
    RETURN;
  END IF;

  EXECUTE
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "VerifiedEmail" TO life_ustc_auth_runtime';

  IF to_regclass('public."VerifiedEmail_id_seq"') IS NOT NULL THEN
    EXECUTE
      'GRANT USAGE, SELECT ON SEQUENCE "VerifiedEmail_id_seq" TO life_ustc_auth_runtime';
  END IF;
END
$grant_verified_email_auth_runtime$;
