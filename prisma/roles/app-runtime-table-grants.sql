-- Shared app-runtime grants for catalog reads, owner RLS tables, and community writes.
-- Included by production and CI runtime bootstrap scripts.

GRANT SELECT ON ALL TABLES IN SCHEMA public TO life_ustc_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO life_ustc_runtime;

DO $revoke_auth_tables$
DECLARE
  auth_table text;
BEGIN
  FOREACH auth_table IN ARRAY ARRAY[
    'Account',
    'Authenticator',
    'DeviceCode',
    'Jwks',
    'OAuthAccessToken',
    'OAuthClient',
    'OAuthConsent',
    'OAuthRefreshToken',
    'Passkey',
    'Session',
    'VerificationToken',
    'VerifiedEmail',
    'oauthClientAssertion',
    'oauthClientResource',
    'oauthResource'
  ]
  LOOP
    IF to_regclass(format('public.%I', auth_table)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE %I FROM life_ustc_runtime',
        auth_table
      );
    END IF;
  END LOOP;
END
$revoke_auth_tables$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "Todo",
  "DashboardLinkClick",
  "DashboardLinkPin",
  "BusUserPreference",
  "UserUstcIdentity",
  "UserSectionSubscription",
  "Upload",
  "UploadPending",
  "HomeworkCompletion"
TO life_ustc_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE "CommentReaction"
TO life_ustc_runtime;

GRANT SELECT, INSERT, UPDATE ON TABLE "Comment" TO life_ustc_runtime;
GRANT INSERT, DELETE ON TABLE "CommentAttachment" TO life_ustc_runtime;
GRANT INSERT, UPDATE ON TABLE "Homework" TO life_ustc_runtime;
GRANT INSERT, UPDATE, DELETE ON TABLE "Description" TO life_ustc_runtime;
GRANT INSERT ON TABLE "DescriptionEdit" TO life_ustc_runtime;
GRANT INSERT ON TABLE "AuditLog" TO life_ustc_runtime;

GRANT SELECT, INSERT, UPDATE ON TABLE "UserSuspension" TO life_ustc_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "BusScheduleVersion"
TO life_ustc_runtime;
GRANT UPDATE ("name", "username", "isAdmin", "calendarFeedToken", "updatedAt") ON TABLE "User"
TO life_ustc_runtime;
