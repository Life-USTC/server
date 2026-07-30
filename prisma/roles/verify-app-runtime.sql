\set ON_ERROR_STOP on

-- Usage: psql "$APP_RUNTIME_DATABASE_URL" -X \
--   -v expected_role=app_runtime \
--   -v expected_schema_privileges="$APP_RUNTIME_SCHEMA_PRIVILEGES" \
--   -v expected_table_privileges="$APP_RUNTIME_TABLE_PRIVILEGES" \
--   -v expected_column_privileges="$APP_RUNTIME_COLUMN_PRIVILEGES" \
--   -v expected_sequence_privileges="$APP_RUNTIME_SEQUENCE_PRIVILEGES" \
--   -v expected_function_privileges="$APP_RUNTIME_FUNCTION_PRIVILEGES" \
--   -f prisma/roles/verify-app-runtime.sql
-- Privilege variables are comma-separated, sorted Object:PRIVILEGE allowlists.
-- The report contains PostgreSQL metadata and booleans, never application rows.
\if :{?expected_role}
\else
  DO $verify$
  BEGIN
    RAISE EXCEPTION 'expected_role is required';
  END
  $verify$;
\endif

BEGIN READ ONLY;

WITH protected(table_name) AS (
  VALUES
    ('Todo'),
    ('DashboardLinkClick'),
    ('DashboardLinkPin'),
    ('BusUserPreference'),
    ('CommentReaction'),
    ('HomeworkCompletion'),
    ('Upload'),
    ('UploadPending'),
    ('UserSectionSubscription')
),
audited_schemas AS (
  SELECT oid, nspname, nspowner, nspacl
  FROM pg_namespace
  WHERE nspname <> 'information_schema'
    AND nspname !~ '^pg_'
),
audited_relations AS (
  SELECT pg_class.*, audited_schemas.nspname AS schema_name
  FROM pg_class
  JOIN audited_schemas ON audited_schemas.oid = pg_class.relnamespace
),
audited_functions AS (
  SELECT
    pg_proc.*,
    audited_schemas.nspname AS schema_name,
    format(
      '%s.%s(%s)',
      audited_schemas.nspname,
      pg_proc.proname,
      pg_get_function_identity_arguments(pg_proc.oid)
    ) AS signature
  FROM pg_proc
  JOIN audited_schemas ON audited_schemas.oid = pg_proc.pronamespace
),
schema_acl AS (
  SELECT audited_schemas.nspname AS schema_name, acl.*
  FROM audited_schemas
  CROSS JOIN LATERAL aclexplode(COALESCE(
    audited_schemas.nspacl,
    acldefault('n', audited_schemas.nspowner)
  )) AS acl
),
relation_acl AS (
  SELECT
    audited_relations.schema_name,
    audited_relations.relname,
    audited_relations.relkind,
    acl.*
  FROM audited_relations
  CROSS JOIN LATERAL aclexplode(COALESCE(
    audited_relations.relacl,
    CASE
      WHEN audited_relations.relkind = 'S'
        THEN acldefault('S', audited_relations.relowner)
      ELSE acldefault('r', audited_relations.relowner)
    END
  )) AS acl
),
column_acl AS (
  SELECT
    audited_relations.schema_name,
    audited_relations.relname,
    pg_attribute.attname,
    acl.*
  FROM audited_relations
  JOIN pg_attribute ON pg_attribute.attrelid = audited_relations.oid
  CROSS JOIN LATERAL aclexplode(pg_attribute.attacl) AS acl
  WHERE pg_attribute.attnum > 0 AND NOT pg_attribute.attisdropped
),
function_acl AS (
  SELECT audited_functions.signature, acl.*
  FROM audited_functions
  CROSS JOIN LATERAL aclexplode(COALESCE(
    audited_functions.proacl,
    acldefault('f', audited_functions.proowner)
  )) AS acl
),
system_direct_acl AS (
  SELECT 1
  FROM pg_namespace AS namespace
  CROSS JOIN LATERAL aclexplode(namespace.nspacl) AS acl
  WHERE (
      namespace.nspname = 'information_schema'
      OR namespace.nspname ~ '^pg_'
    )
    AND acl.grantee = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
  UNION ALL
  SELECT 1
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL aclexplode(relation.relacl) AS acl
  WHERE (
      namespace.nspname = 'information_schema'
      OR namespace.nspname ~ '^pg_'
    )
    AND acl.grantee = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
  UNION ALL
  SELECT 1
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
  WHERE (
      namespace.nspname = 'information_schema'
      OR namespace.nspname ~ '^pg_'
    )
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND acl.grantee = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
  UNION ALL
  SELECT 1
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL aclexplode(procedure.proacl) AS acl
  WHERE (
      namespace.nspname = 'information_schema'
      OR namespace.nspname ~ '^pg_'
    )
    AND acl.grantee = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
),
system_owned_objects AS (
  SELECT 1
  FROM pg_namespace AS namespace
  WHERE (
      namespace.nspname = 'information_schema'
      OR namespace.nspname ~ '^pg_'
    )
    AND namespace.nspowner = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
  UNION ALL
  SELECT 1
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE (
      namespace.nspname = 'information_schema'
      OR namespace.nspname ~ '^pg_'
    )
    AND relation.relowner = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
  UNION ALL
  SELECT 1
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE (
      namespace.nspname = 'information_schema'
      OR namespace.nspname ~ '^pg_'
    )
    AND procedure.proowner = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
),
effective_schema_privileges(actual) AS (
  SELECT COALESCE(string_agg(
    format('%s:%s', schema_acl.schema_name, schema_acl.privilege_type),
    ',' ORDER BY schema_acl.schema_name, schema_acl.privilege_type
  ), '')
  FROM schema_acl
  WHERE schema_acl.grantee = (
    SELECT oid FROM pg_roles WHERE rolname = current_user
  )
),
effective_table_privileges(actual) AS (
  SELECT COALESCE(string_agg(
    format(
      '%s.%s:%s',
      relation_acl.schema_name,
      relation_acl.relname,
      relation_acl.privilege_type
    ),
    ',' ORDER BY relation_acl.schema_name, relation_acl.relname,
      relation_acl.privilege_type
  ), '')
  FROM relation_acl
  WHERE relation_acl.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND relation_acl.grantee = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
),
effective_sequence_privileges(actual) AS (
  SELECT COALESCE(string_agg(
    format(
      '%s.%s:%s',
      relation_acl.schema_name,
      relation_acl.relname,
      relation_acl.privilege_type
    ),
    ',' ORDER BY relation_acl.schema_name, relation_acl.relname,
      relation_acl.privilege_type
  ), '')
  FROM relation_acl
  WHERE relation_acl.relkind = 'S'
    AND relation_acl.grantee = (
      SELECT oid FROM pg_roles WHERE rolname = current_user
    )
),
effective_function_privileges(actual) AS (
  SELECT COALESCE(string_agg(
    format('%s:%s', function_acl.signature, function_acl.privilege_type),
    ',' ORDER BY function_acl.signature, function_acl.privilege_type
  ), '')
  FROM function_acl
  WHERE function_acl.grantee = (
    SELECT oid FROM pg_roles WHERE rolname = current_user
  )
),
explicit_column_privileges(actual) AS (
  SELECT COALESCE(string_agg(
    format(
      '%s.%s.%s:%s',
      column_acl.schema_name,
      column_acl.relname,
      column_acl.attname,
      column_acl.privilege_type
    ),
    ',' ORDER BY column_acl.schema_name, column_acl.relname,
      column_acl.attname, column_acl.privilege_type
  ), '')
  FROM column_acl
  WHERE column_acl.grantee = (
    SELECT oid FROM pg_roles WHERE rolname = current_user
  )
),
object_creators(role_oid) AS (
  SELECT DISTINCT relowner FROM audited_relations
  UNION
  SELECT DISTINCT proowner FROM audited_functions
  UNION
  SELECT DISTINCT role.oid
  FROM pg_roles AS role
  WHERE role.rolname <> 'pg_database_owner'
    AND EXISTS (
      SELECT 1
      FROM audited_schemas
      WHERE has_schema_privilege(role.oid, audited_schemas.oid, 'CREATE')
    )
),
function_creators(role_oid) AS (
  SELECT DISTINCT proowner FROM audited_functions
  UNION
  SELECT DISTINCT role.oid
  FROM pg_roles AS role
  WHERE role.rolname <> 'pg_database_owner'
    AND EXISTS (
      SELECT 1
      FROM audited_schemas
      WHERE has_schema_privilege(role.oid, audited_schemas.oid, 'CREATE')
    )
),
protected_contract AS (
  SELECT
    count(*) = (SELECT count(*) FROM protected)
    AND count(audited_relations.oid) = (SELECT count(*) FROM protected)
    AND count(pg_policies.policyname) = (SELECT count(*) FROM protected)
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policies AS runtime_policy
      JOIN protected AS protected_policy
        ON protected_policy.table_name = runtime_policy.tablename
      WHERE runtime_policy.schemaname = 'public'
        AND runtime_policy.roles && ARRAY[
          'public'::name,
          current_user::name
        ]
        AND runtime_policy.policyname <>
          protected_policy.table_name || '_owner_isolation'
    )
    AND bool_and(
      COALESCE(
        audited_relations.relrowsecurity
        AND audited_relations.relforcerowsecurity
        AND pg_get_userbyid(audited_relations.relowner) <> current_user
        AND pg_policies.policyname =
          protected.table_name || '_owner_isolation'
        AND pg_policies.permissive = 'PERMISSIVE'
        AND pg_policies.roles = ARRAY['public']::name[]
        AND pg_policies.cmd = 'ALL'
        AND replace(pg_policies.qual, '::text', '') =
          '("userId" = NULLIF(current_setting(''app.user_id'', true), ''''))'
        AND replace(pg_policies.with_check, '::text', '') =
          replace(pg_policies.qual, '::text', ''),
        false
      )
    ) AS passed
  FROM protected
  LEFT JOIN audited_relations
    ON audited_relations.schema_name = 'public'
    AND audited_relations.relname = protected.table_name
  LEFT JOIN pg_policies
    ON pg_policies.schemaname = 'public'
    AND pg_policies.tablename = protected.table_name
    AND pg_policies.policyname = protected.table_name || '_owner_isolation'
),
checks(name, passed) AS (
  SELECT
    'role_identity',
    session_user = current_user
    AND current_user = :'expected_role'
    AND COALESCE((
      SELECT
        rolcanlogin
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolinherit
        AND NOT rolreplication
        AND NOT rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    ), false)
  UNION ALL
  SELECT
    'database_boundary',
    has_database_privilege(current_user, current_database(), 'CONNECT')
    AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
    AND NOT has_database_privilege(
      current_user,
      current_database(),
      'TEMPORARY'
    )
    AND (
      SELECT pg_get_userbyid(datdba) <> current_user
      FROM pg_database
      WHERE datname = current_database()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_database
      CROSS JOIN LATERAL aclexplode(
        COALESCE(datacl, acldefault('d', datdba))
      ) AS acl
      WHERE datname = current_database() AND acl.grantee = 0
    )
  UNION ALL
  SELECT
    'schema_boundary',
    (SELECT actual FROM effective_schema_privileges) =
      :'expected_schema_privileges'
    AND NOT EXISTS (
      SELECT 1
      FROM schema_acl
      WHERE schema_acl.grantee = 0
    )
  UNION ALL
  SELECT
    'memberships',
    NOT EXISTS (
      SELECT 1
      FROM pg_auth_members
      JOIN pg_roles AS member ON member.oid = pg_auth_members.member
      JOIN pg_roles AS parent ON parent.oid = pg_auth_members.roleid
      WHERE member.rolname = current_user OR parent.rolname = current_user
    )
  UNION ALL
  SELECT
    'system_object_boundary',
    NOT EXISTS (SELECT 1 FROM system_direct_acl)
    AND NOT EXISTS (SELECT 1 FROM system_owned_objects)
  UNION ALL
  SELECT
    'relation_ownership',
    NOT EXISTS (
      SELECT 1
      FROM audited_relations
      WHERE relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM audited_functions
      WHERE audited_functions.proowner = (
          SELECT oid FROM pg_roles WHERE rolname = current_user
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM audited_schemas
      WHERE nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
    )
  UNION ALL
  SELECT
    'table_privileges',
    (SELECT actual FROM effective_table_privileges) =
      :'expected_table_privileges'
  UNION ALL
  SELECT
    'column_privileges',
    (SELECT actual FROM explicit_column_privileges) =
      :'expected_column_privileges'
  UNION ALL
  SELECT
    'sequence_privileges',
    (SELECT actual FROM effective_sequence_privileges) =
      :'expected_sequence_privileges'
  UNION ALL
  SELECT
    'function_privileges',
    (SELECT actual FROM effective_function_privileges) =
      :'expected_function_privileges'
  UNION ALL
  SELECT
    'public_object_acl',
    NOT EXISTS (
      SELECT 1
      FROM relation_acl
      WHERE relation_acl.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
        AND relation_acl.grantee = 0
    )
    AND NOT EXISTS (
      SELECT 1
      FROM function_acl
      WHERE function_acl.grantee = 0
    )
    AND NOT EXISTS (
      SELECT 1
      FROM column_acl
      WHERE column_acl.grantee = 0
    )
  UNION ALL
  SELECT
    'grant_options',
    NOT EXISTS (
      SELECT 1
      FROM (
        SELECT acl.grantee, acl.is_grantable
        FROM pg_database
        CROSS JOIN LATERAL aclexplode(datacl) AS acl
        WHERE datname = current_database()
        UNION ALL
        SELECT schema_acl.grantee, schema_acl.is_grantable
        FROM schema_acl
        UNION ALL
        SELECT relation_acl.grantee, relation_acl.is_grantable
        FROM relation_acl
        UNION ALL
        SELECT column_acl.grantee, column_acl.is_grantable
        FROM column_acl
        UNION ALL
        SELECT function_acl.grantee, function_acl.is_grantable
        FROM function_acl
      ) AS grants
      WHERE grants.grantee = (
          SELECT oid FROM pg_roles WHERE rolname = current_user
        )
        AND grants.is_grantable
    )
  UNION ALL
  SELECT
    'default_acl',
    NOT EXISTS (
      SELECT 1
      FROM pg_default_acl
      JOIN object_creators ON object_creators.role_oid = defaclrole
      CROSS JOIN LATERAL aclexplode(defaclacl) AS acl
      WHERE (
          defaclnamespace = 0
          OR defaclnamespace IN (SELECT oid FROM audited_schemas)
        )
        AND acl.grantee IN (
          0,
          (SELECT oid FROM pg_roles WHERE rolname = current_user)
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM function_creators
      CROSS JOIN LATERAL aclexplode(COALESCE(
        (
          SELECT defaclacl
          FROM pg_default_acl
          WHERE defaclrole = function_creators.role_oid
            AND defaclnamespace = 0
            AND defaclobjtype = 'f'
        ),
        acldefault('f', function_creators.role_oid)
      )) AS acl
      WHERE acl.grantee = 0
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_default_acl
      JOIN function_creators ON function_creators.role_oid = defaclrole
      CROSS JOIN LATERAL aclexplode(defaclacl) AS acl
      WHERE defaclnamespace IN (SELECT oid FROM audited_schemas)
        AND defaclobjtype = 'f'
        AND acl.grantee = 0
    )
  UNION ALL
  SELECT 'protected_tables', passed FROM protected_contract
  UNION ALL
  SELECT
    'missing_context_default_deny',
    NULLIF(current_setting('app.user_id', true), '') IS NULL
    AND NOT EXISTS (SELECT 1 FROM public."Todo" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."DashboardLinkClick" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."DashboardLinkPin" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."BusUserPreference" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."CommentReaction" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."HomeworkCompletion" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."Upload" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."UploadPending" LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public."UserSectionSubscription" LIMIT 1)
)
SELECT
  jsonb_object_agg(name, COALESCE(passed, false) ORDER BY name)::text AS report,
  bool_and(COALESCE(passed, false)) AS contract_ok
FROM checks
\gset runtime_

ROLLBACK;

\echo :runtime_report
\if :runtime_contract_ok
\else
  DO $verify$
  BEGIN
    RAISE EXCEPTION 'app runtime RLS preflight failed';
  END
  $verify$;
\endif
