-- Existing deployments receive the same write grants as a fresh role bootstrap.
-- Neither role gains delete access or access to audit log contents.
DO $restore_runtime_write_grants$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public."WeatherObservation"
      TO life_ustc_runtime;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime'
  ) THEN
    GRANT INSERT ON TABLE public."AuditLog" TO life_ustc_auth_runtime;
  END IF;
END
$restore_runtime_write_grants$;
