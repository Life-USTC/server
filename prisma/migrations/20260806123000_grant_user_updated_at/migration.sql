-- Prisma User updates always touch updatedAt alongside mutable columns.
-- Without this grant, calendarFeedToken minting (and other app User updates)
-- still fail with SQLSTATE 42501 even when the target column is granted.

DO $grant_user_updated_at$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE 'Skipping User.updatedAt grant; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  EXECUTE
    'GRANT UPDATE ("updatedAt") ON TABLE "User" TO life_ustc_runtime';
END
$grant_user_updated_at$;
