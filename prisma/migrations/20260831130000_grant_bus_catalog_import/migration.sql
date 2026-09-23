-- The authenticated admin import runs through the unprivileged app role.
-- Grant only the catalog writes performed by importBusStaticPayload.
DO $grant_bus_catalog_import$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
  ) THEN
    RAISE NOTICE 'Skipping bus import grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  GRANT INSERT, UPDATE ON TABLE "BusCampus", "BusRoute"
  TO life_ustc_runtime;
  GRANT INSERT, DELETE ON TABLE "BusRouteStop", "BusTrip"
  TO life_ustc_runtime;
  GRANT USAGE, SELECT ON SEQUENCE "BusRouteStop_id_seq", "BusTrip_id_seq"
  TO life_ustc_runtime;
END
$grant_bus_catalog_import$;
