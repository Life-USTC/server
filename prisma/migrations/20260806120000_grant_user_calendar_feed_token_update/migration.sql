-- Allow the app runtime to mint User.calendarFeedToken for ICS feed URLs.
-- Workspace/calendar/subscriptions/section SSR call ensureUserCalendarFeedToken
-- when the token is null; without this column grant those loads 500.

DO $grant_user_calendar_feed_token$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE 'Skipping User.calendarFeedToken grant; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  EXECUTE
    'GRANT UPDATE ("calendarFeedToken") ON TABLE "User" TO life_ustc_runtime';
END
$grant_user_calendar_feed_token$;
