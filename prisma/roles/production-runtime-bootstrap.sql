\set ON_ERROR_STOP on

-- Production runtime role bootstrap. Run as postgres superuser after migrations.
-- Usage:
--   psql "$DATABASE_URL" -X --single-transaction \
--     --set=database_name=life-ustc \
--     --set=app_password='...' \
--     --set=auth_password='...' \
--     --set=maintenance_password='...' \
--     --file=prisma/roles/production-runtime-bootstrap.sql

SELECT 'CREATE ROLE life_ustc_runtime'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
) \gexec

SELECT 'CREATE ROLE life_ustc_auth_runtime'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime'
) \gexec

SELECT 'CREATE ROLE life_ustc_maintenance_runtime'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_maintenance_runtime'
) \gexec

SELECT 'CREATE ROLE life_ustc_function_owner'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner'
) \gexec

ALTER ROLE life_ustc_runtime
  LOGIN
  PASSWORD :'app_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS;

ALTER ROLE life_ustc_auth_runtime
  LOGIN
  PASSWORD :'auth_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS;

ALTER ROLE life_ustc_maintenance_runtime
  LOGIN
  PASSWORD :'maintenance_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS;

ALTER ROLE life_ustc_function_owner
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS;

SELECT format('REVOKE %I FROM %I', parent.rolname, member.rolname)
FROM pg_auth_members
JOIN pg_roles AS member ON member.oid = pg_auth_members.member
JOIN pg_roles AS parent ON parent.oid = pg_auth_members.roleid
WHERE member.rolname IN (
  'life_ustc_runtime',
  'life_ustc_auth_runtime',
  'life_ustc_maintenance_runtime',
  'life_ustc_function_owner'
)
\gexec

SELECT format('REVOKE %I FROM %I', parent.rolname, member.rolname)
FROM pg_auth_members
JOIN pg_roles AS member ON member.oid = pg_auth_members.member
JOIN pg_roles AS parent ON parent.oid = pg_auth_members.roleid
WHERE parent.rolname IN (
  'life_ustc_runtime',
  'life_ustc_auth_runtime',
  'life_ustc_maintenance_runtime',
  'life_ustc_function_owner'
)
\gexec

REVOKE ALL PRIVILEGES ON DATABASE :"database_name" FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES
  REVOKE ALL ON TABLES
  FROM PUBLIC,
    life_ustc_runtime,
    life_ustc_auth_runtime,
    life_ustc_maintenance_runtime,
    life_ustc_function_owner;
ALTER DEFAULT PRIVILEGES
  REVOKE ALL ON SEQUENCES
  FROM PUBLIC,
    life_ustc_runtime,
    life_ustc_auth_runtime,
    life_ustc_maintenance_runtime,
    life_ustc_function_owner;
ALTER DEFAULT PRIVILEGES
  REVOKE EXECUTE ON FUNCTIONS
  FROM PUBLIC,
    life_ustc_runtime,
    life_ustc_auth_runtime,
    life_ustc_maintenance_runtime,
    life_ustc_function_owner;
ALTER DEFAULT PRIVILEGES FOR ROLE life_ustc_function_owner
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

REVOKE ALL PRIVILEGES ON DATABASE :"database_name" FROM life_ustc_runtime;
REVOKE ALL ON SCHEMA public FROM life_ustc_runtime;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM life_ustc_runtime;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM life_ustc_runtime;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM life_ustc_runtime;

REVOKE ALL PRIVILEGES ON DATABASE :"database_name" FROM life_ustc_auth_runtime;
REVOKE ALL ON SCHEMA public FROM life_ustc_auth_runtime;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM life_ustc_auth_runtime;
SELECT pg_catalog.format(
  'REVOKE ALL PRIVILEGES (%s) ON TABLE %I.%I FROM %I',
  pg_catalog.string_agg(
    pg_catalog.format('%I', attribute.attname),
    ', ' ORDER BY attribute.attnum
  ),
  namespace.nspname,
  relation.relname,
  runtime_role.role_name
)
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = relation.relnamespace
JOIN pg_catalog.pg_attribute AS attribute
  ON attribute.attrelid = relation.oid
CROSS JOIN (
  VALUES
    ('life_ustc_runtime'),
    ('life_ustc_auth_runtime'),
    ('life_ustc_maintenance_runtime'),
    ('life_ustc_function_owner')
) AS runtime_role(role_name)
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
GROUP BY namespace.nspname, relation.relname, runtime_role.role_name
\gexec
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM life_ustc_auth_runtime;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM life_ustc_auth_runtime;

REVOKE ALL PRIVILEGES ON DATABASE :"database_name" FROM life_ustc_maintenance_runtime;
REVOKE ALL ON SCHEMA public FROM life_ustc_maintenance_runtime;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM life_ustc_maintenance_runtime;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM life_ustc_maintenance_runtime;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM life_ustc_maintenance_runtime;

REVOKE ALL PRIVILEGES ON DATABASE :"database_name" FROM life_ustc_function_owner;
REVOKE ALL ON SCHEMA public FROM life_ustc_function_owner;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM life_ustc_function_owner;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM life_ustc_function_owner;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM life_ustc_function_owner;

GRANT CONNECT ON DATABASE :"database_name" TO life_ustc_runtime;
GRANT USAGE ON SCHEMA public TO life_ustc_runtime;
\ir app-runtime-table-grants.sql

GRANT CONNECT ON DATABASE :"database_name" TO life_ustc_auth_runtime;
GRANT USAGE ON SCHEMA public TO life_ustc_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "Account",
  "Session",
  "VerificationToken",
  "Passkey",
  "OAuthClient",
  "DeviceCode",
  "OAuthRefreshToken",
  "OAuthAccessToken",
  "OAuthConsent",
  "oauthResource",
  "oauthClientResource",
  "oauthClientAssertion"
TO life_ustc_auth_runtime;
GRANT DELETE ON TABLE "User" TO life_ustc_auth_runtime;
GRANT SELECT (
  "id",
  "email",
  "emailVerified",
  "name",
  "username",
  "image",
  "profilePictures",
  "isAdmin",
  "createdAt",
  "updatedAt"
) ON TABLE "User" TO life_ustc_auth_runtime;
GRANT INSERT (
  "id",
  "email",
  "emailVerified",
  "name",
  "image",
  "createdAt",
  "updatedAt"
) ON TABLE "User" TO life_ustc_auth_runtime;
GRANT UPDATE (
  "email",
  "emailVerified",
  "name",
  "username",
  "image",
  "updatedAt"
) ON TABLE "User" TO life_ustc_auth_runtime;
GRANT SELECT, INSERT ON TABLE "Jwks" TO life_ustc_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "VerifiedEmail"
TO life_ustc_auth_runtime;
GRANT USAGE, SELECT ON SEQUENCE "VerifiedEmail_id_seq"
TO life_ustc_auth_runtime;

GRANT USAGE ON SCHEMA public TO life_ustc_function_owner;
GRANT SELECT ON TABLE
  "Upload",
  "UploadPending",
  "CommentAttachment",
  "Comment",
  "User",
  "CommentReaction",
  "HomeworkCompletion"
TO life_ustc_function_owner;
GRANT UPDATE, DELETE ON TABLE "UploadPending"
TO life_ustc_function_owner;
GRANT SELECT, DELETE ON TABLE
  "Account",
  "VerifiedEmail",
  "OAuthAccessToken",
  "OAuthRefreshToken",
  "DeviceCode",
  "VerificationToken",
  "Session"
TO life_ustc_function_owner;
GRANT UPDATE ("id") ON TABLE "User" TO life_ustc_function_owner;
GRANT UPDATE ("id") ON TABLE "OAuthAccessToken" TO life_ustc_function_owner;
GRANT UPDATE ("id") ON TABLE "OAuthRefreshToken" TO life_ustc_function_owner;
GRANT UPDATE ("id") ON TABLE "DeviceCode" TO life_ustc_function_owner;
GRANT UPDATE ("id") ON TABLE "VerificationToken" TO life_ustc_function_owner;
GRANT UPDATE ("id") ON TABLE "Session" TO life_ustc_function_owner;

ALTER FUNCTION public.cleanup_expired_auth_records(
  timestamp without time zone,
  integer
) OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.unlink_settings_account(text, text)
  OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.find_downloadable_upload(text)
  OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.comment_attachment_summaries(text[])
  OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.get_public_profile_upload_stats(
  text,
  timestamp without time zone
) OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.comment_reaction_summaries(text[])
  OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.comment_hidden_root_count(
  integer,
  integer,
  integer,
  text,
  integer
) OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.get_public_profile_homework_completions(
  text,
  timestamp without time zone
) OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.get_public_profile_section_subscription_count(text)
  OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.claim_upload_pending_storage_cleanup(
  timestamp without time zone,
  integer,
  integer
) OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.finalize_upload_pending_storage_cleanup(text, text)
  OWNER TO life_ustc_function_owner;
ALTER FUNCTION public.release_upload_pending_storage_cleanup(
  text,
  text,
  timestamp without time zone,
  integer
) OWNER TO life_ustc_function_owner;

DROP POLICY IF EXISTS "Upload_definer_read" ON "Upload";
CREATE POLICY "Upload_definer_read" ON "Upload"
  FOR SELECT
  TO life_ustc_function_owner
  USING (true);

DROP POLICY IF EXISTS "CommentReaction_definer_read" ON "CommentReaction";
ALTER POLICY "CommentReaction_summary_reader" ON "CommentReaction"
  TO life_ustc_function_owner;

DROP POLICY IF EXISTS "Comment_hidden_count_definer_read" ON "Comment";
ALTER POLICY "Comment_hidden_count_reader" ON "Comment"
  TO life_ustc_function_owner;

ALTER POLICY "HomeworkCompletion_profile_reader" ON "HomeworkCompletion"
  TO life_ustc_function_owner;

DROP POLICY IF EXISTS "UserSectionSubscription_profile_reader" ON "UserSectionSubscription";
CREATE POLICY "UserSectionSubscription_profile_reader" ON "UserSectionSubscription"
  FOR SELECT
  TO life_ustc_function_owner
  USING (true);

DROP POLICY IF EXISTS "UploadPending_cleanup_worker" ON "UploadPending";
CREATE POLICY "UploadPending_cleanup_worker" ON "UploadPending"
  FOR ALL
  TO life_ustc_function_owner
  USING (true)
  WITH CHECK (true);

GRANT EXECUTE ON FUNCTION public.unlink_settings_account(text, text)
  TO life_ustc_auth_runtime;
GRANT EXECUTE ON FUNCTION
  public.find_downloadable_upload(text),
  public.comment_attachment_summaries(text[]),
  public.get_public_profile_upload_stats(text, timestamp without time zone),
  public.comment_reaction_summaries(text[]),
  public.comment_hidden_root_count(integer, integer, integer, text, integer),
  public.get_public_profile_homework_completions(text, timestamp without time zone),
  public.get_public_profile_section_subscription_count(text),
  public.claim_upload_pending_storage_cleanup(
    timestamp without time zone,
    integer,
    integer
  ),
  public.finalize_upload_pending_storage_cleanup(text, text),
  public.release_upload_pending_storage_cleanup(
    text,
    text,
    timestamp without time zone,
    integer
  )
TO life_ustc_runtime;

GRANT CONNECT ON DATABASE :"database_name" TO life_ustc_maintenance_runtime;
GRANT USAGE ON SCHEMA public TO life_ustc_maintenance_runtime;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_auth_records(
  timestamp without time zone,
  integer
) TO life_ustc_maintenance_runtime;
GRANT EXECUTE ON FUNCTION public.claim_upload_pending_storage_cleanup(
  timestamp without time zone,
  integer,
  integer
),
  public.finalize_upload_pending_storage_cleanup(text, text),
  public.release_upload_pending_storage_cleanup(
    text,
    text,
    timestamp without time zone,
    integer
  )
TO life_ustc_maintenance_runtime;
