-- Re-apply app-runtime catalog and community grants after the RLS cutover.
-- No-op when life_ustc_runtime is not provisioned (local CI Postgres).

DO $apply_app_runtime_grants$
DECLARE
  auth_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE 'Skipping app runtime table grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO life_ustc_runtime';
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO life_ustc_runtime';

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

  EXECUTE $grant_owner_tables$
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      "Todo",
      "DashboardLinkClick",
      "DashboardLinkPin",
      "BusUserPreference",
      "Upload",
      "UploadPending",
      "HomeworkCompletion"
    TO life_ustc_runtime
  $grant_owner_tables$;

  EXECUTE $grant_comment_reaction$
    GRANT SELECT, INSERT, DELETE ON TABLE "CommentReaction"
    TO life_ustc_runtime
  $grant_comment_reaction$;

  EXECUTE $grant_community_writes$
    GRANT INSERT, UPDATE ON TABLE "Comment" TO life_ustc_runtime
  $grant_community_writes$;
  EXECUTE $grant_comment_attachment$
    GRANT INSERT, DELETE ON TABLE "CommentAttachment" TO life_ustc_runtime
  $grant_comment_attachment$;
  EXECUTE $grant_homework$
    GRANT INSERT, UPDATE ON TABLE "Homework" TO life_ustc_runtime
  $grant_homework$;
  EXECUTE $grant_homework_audit$
    GRANT INSERT ON TABLE "HomeworkAuditLog" TO life_ustc_runtime
  $grant_homework_audit$;
  EXECUTE $grant_description$
    GRANT INSERT, UPDATE, DELETE ON TABLE "Description" TO life_ustc_runtime
  $grant_description$;
  EXECUTE $grant_description_edit$
    GRANT INSERT ON TABLE "DescriptionEdit" TO life_ustc_runtime
  $grant_description_edit$;
  EXECUTE $grant_audit_log$
    GRANT INSERT ON TABLE "AuditLog" TO life_ustc_runtime
  $grant_audit_log$;

  EXECUTE $grant_user_suspension$
    GRANT SELECT, INSERT, UPDATE ON TABLE "UserSuspension" TO life_ustc_runtime
  $grant_user_suspension$;
  EXECUTE $grant_bus_schedule_version$
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "BusScheduleVersion"
    TO life_ustc_runtime
  $grant_bus_schedule_version$;
  EXECUTE $grant_user_profile$
    GRANT UPDATE ("name", "username", "isAdmin") ON TABLE "User"
    TO life_ustc_runtime
  $grant_user_profile$;
END
$apply_app_runtime_grants$;
