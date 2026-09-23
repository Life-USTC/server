-- The app runtime role reads YoungEvent for the public catalog pages and
-- APIs; writes happen through the migrator role during static imports.
-- No-op when life_ustc_runtime is not provisioned (local CI Postgres).
DO $grant_young_event$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
  ) THEN
    RAISE NOTICE 'Skipping young event grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  GRANT SELECT ON TABLE "YoungEvent"
  TO life_ustc_runtime;
END
$grant_young_event$;
