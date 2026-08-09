-- The upload-pending cleanup functions run as life_ustc_function_owner.
-- Keep their table ACL aligned with the UploadPending cleanup policy.
DO $grant_upload_pending_function_owner$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'life_ustc_function_owner'
  ) THEN
    RAISE NOTICE
      'Skipping UploadPending function-owner grants; role does not exist.';
    RETURN;
  END IF;

  EXECUTE
    'GRANT SELECT, UPDATE, DELETE ON TABLE public."UploadPending" '
    'TO life_ustc_function_owner';
END
$grant_upload_pending_function_owner$;
