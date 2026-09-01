-- The cron weather-history writer runs through the unprivileged app role.
-- writeWeatherHistory upserts hourly snapshots into WeatherObservation,
-- which needs SELECT (conflict check), INSERT, and UPDATE (ON CONFLICT DO UPDATE).
DO $grant_weather_observation$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
  ) THEN
    RAISE NOTICE 'Skipping weather observation grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE ON TABLE "WeatherObservation"
  TO life_ustc_runtime;
END
$grant_weather_observation$;
