\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on
\pset pager off

-- Inventory only: no application relation, expression, or function body executes.
-- PostgreSQL 16+ is required for membership inherit_option / set_option.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL search_path = pg_catalog;

WITH RECURSIVE
wanted_roles(name) AS (
  VALUES
    (current_user::text), (session_user::text),
    ('life_ustc_runtime'), ('life_ustc_auth_runtime'),
    ('life_ustc_maintenance_runtime'), ('life_ustc_function_owner'),
    ('life_ustc_importer')
),
subjects AS (
  SELECT DISTINCT r.oid, r.rolname, r.rolsuper, r.rolinherit, r.rolcreaterole,
    r.rolcreatedb, r.rolcanlogin, r.rolreplication, r.rolbypassrls
  FROM pg_catalog.pg_roles AS r
  JOIN wanted_roles AS w ON w.name = r.rolname
),
membership_nodes(oid) AS (
  SELECT oid FROM subjects
  UNION
  SELECT membership.roleid
  FROM pg_catalog.pg_auth_members AS membership
  JOIN membership_nodes AS child ON child.oid = membership.member
),
audited_roles AS (
  SELECT r.oid, r.rolname, r.rolsuper, r.rolinherit, r.rolcreaterole,
    r.rolcreatedb, r.rolcanlogin, r.rolreplication, r.rolbypassrls
  FROM pg_catalog.pg_roles r JOIN membership_nodes scope ON scope.oid = r.oid
  ORDER BY r.rolname
  LIMIT 64
),
bounded_memberships AS (
  SELECT m.* FROM pg_catalog.pg_auth_members m
  JOIN membership_nodes scope ON scope.oid = m.member
  ORDER BY m.member, m.roleid
  LIMIT 256
),
user_schemas AS (
  SELECT n.oid, n.nspname, n.nspowner
  FROM pg_catalog.pg_namespace AS n
  WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
  ORDER BY n.nspname
  LIMIT 32
),
relations AS (
  SELECT c.oid, c.relname, n.nspname, c.relkind, c.relowner,
    c.relrowsecurity, c.relforcerowsecurity
  FROM pg_catalog.pg_class AS c
  JOIN user_schemas AS n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
  ORDER BY n.nspname, c.relname
  LIMIT 256
),
functions AS (
  SELECT p.oid, p.proname, p.proowner, p.prosecdef,
    n.nspname,
    COALESCE((SELECT pg_catalog.array_agg(type_namespace.nspname || '.' || type_record.typname ORDER BY argument.position)
      FROM pg_catalog.unnest(p.proargtypes::oid[]) WITH ORDINALITY argument(type_oid, position)
      JOIN pg_catalog.pg_type type_record ON type_record.oid = argument.type_oid
      JOIN pg_catalog.pg_namespace type_namespace ON type_namespace.oid = type_record.typnamespace
    ), '{}'::text[]) AS arguments
  FROM pg_catalog.pg_proc AS p
  JOIN user_schemas AS n ON n.oid = p.pronamespace
  ORDER BY n.nspname, p.proname, p.oid
  LIMIT 256
),
bounded_default_acl AS (
  SELECT d.defaclrole, d.defaclnamespace, d.defaclobjtype,
    acl.grantee, acl.privilege_type, acl.is_grantable
  FROM pg_catalog.pg_default_acl d
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
  WHERE d.defaclnamespace = 0 OR d.defaclnamespace IN (SELECT oid FROM user_schemas)
  ORDER BY d.defaclrole, d.defaclnamespace, d.defaclobjtype, acl.grantee, acl.privilege_type
  LIMIT 512
),
policies AS (
  SELECT p.oid, p.polrelid, p.polname, p.polcmd, p.polpermissive, p.polroles,
    p.polqual, p.polwithcheck, r.nspname, r.relname
  FROM pg_catalog.pg_policy AS p
  JOIN relations AS r ON r.oid = p.polrelid
  ORDER BY r.nspname, r.relname, p.polname
  LIMIT 256
)
SELECT pg_catalog.jsonb_build_object(
  'format_version', 1,
  'scope', 'system-catalog-metadata-only',
  'server_version_num', pg_catalog.current_setting('server_version_num')::integer,
  'session', pg_catalog.jsonb_build_object(
    'session_user', session_user, 'current_user', current_user,
    'expected_role', :'expected_role',
    'identity_matches_expected', session_user = current_user AND current_user = :'expected_role',
    'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
    'statement_timeout', pg_catalog.current_setting('statement_timeout'),
    'lock_timeout', pg_catalog.current_setting('lock_timeout'),
    'row_security', pg_catalog.current_setting('row_security')
  ),
  'limits', pg_catalog.jsonb_build_object(
    'audited_roles', 64, 'audited_role_count', (SELECT count(*) FROM membership_nodes), 'schemas', 32, 'relations', 256, 'functions', 256, 'policies', 256, 'membership_edges', 256, 'default_acl_rows', 512, 'columns_per_relation', 128,
    'schema_count', (SELECT count(*) FROM pg_catalog.pg_namespace n WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'),
    'relation_count', (SELECT count(*) FROM pg_catalog.pg_class c JOIN user_schemas n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p','v','m','f','S')),
    'function_count', (SELECT count(*) FROM pg_catalog.pg_proc p JOIN user_schemas n ON n.oid = p.pronamespace),
    'policy_count', (SELECT count(*) FROM pg_catalog.pg_policy p JOIN relations r ON r.oid = p.polrelid),
    'membership_edge_count', (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN membership_nodes scope ON scope.oid = m.member),
    'default_acl_row_count', (SELECT count(*) FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl WHERE d.defaclnamespace = 0 OR d.defaclnamespace IN (SELECT oid FROM user_schemas)),
    'oversized_column_relations', (SELECT count(DISTINCT a.attrelid) FROM pg_catalog.pg_attribute a JOIN relations r ON r.oid = a.attrelid WHERE a.attnum > 128 AND NOT a.attisdropped)
  ),
  'roles', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', w.name, 'present', r.oid IS NOT NULL,
      'superuser', r.rolsuper, 'inherit', r.rolinherit,
      'create_role', r.rolcreaterole, 'create_database', r.rolcreatedb,
      'login', r.rolcanlogin, 'replication', r.rolreplication, 'bypass_rls', r.rolbypassrls
    ) ORDER BY w.name)
    FROM (SELECT DISTINCT name FROM wanted_roles UNION SELECT rolname::text FROM audited_roles) w
    LEFT JOIN audited_roles r ON r.rolname = w.name
  ), '[]'::jsonb),
  'role_capabilities', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'subject', subject.rolname, 'target', target.rolname,
      'member', pg_catalog.pg_has_role(subject.oid, target.oid, 'MEMBER'),
      'available_without_set_role', pg_catalog.pg_has_role(subject.oid, target.oid, 'USAGE'),
      'can_set_role', pg_catalog.pg_has_role(subject.oid, target.oid, 'SET')
    ) ORDER BY subject.rolname, target.rolname)
    FROM subjects subject CROSS JOIN audited_roles target
  ), '[]'::jsonb),
  'membership_edges', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'member', child.rolname, 'parent', parent.rolname,
      'admin_option', m.admin_option, 'inherit_option', m.inherit_option, 'set_option', m.set_option
    ) ORDER BY child.rolname, parent.rolname)
    FROM bounded_memberships m
    JOIN pg_catalog.pg_roles child ON child.oid = m.member
    JOIN pg_catalog.pg_roles parent ON parent.oid = m.roleid
  ), '[]'::jsonb),
  'schemas', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', n.nspname, 'owner', pg_catalog.pg_get_userbyid(n.nspowner),
      'role', r.rolname,
      'usage', pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE'),
      'create', pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE')
    ) ORDER BY n.nspname, r.rolname)
    FROM user_schemas n CROSS JOIN subjects r
  ), '[]'::jsonb),
  'relations', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', c.nspname, 'name', c.relname, 'kind', c.relkind,
      'owner', pg_catalog.pg_get_userbyid(c.relowner),
      'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity,
      'current_session_rls_active', CASE WHEN c.relkind IN ('r','p') THEN pg_catalog.row_security_active(c.oid) ELSE NULL END,
      'role_privileges', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'role', r.rolname,
        'owner_privileges_immediately_available', pg_catalog.pg_has_role(r.oid, c.relowner, 'USAGE'),
        'can_set_owner_role', pg_catalog.pg_has_role(r.oid, c.relowner, 'SET'),
        'select', CASE WHEN c.relkind = 'S' THEN pg_catalog.has_sequence_privilege(r.oid, c.oid, 'SELECT') ELSE pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT') END,
        'insert', CASE WHEN c.relkind <> 'S' THEN pg_catalog.has_table_privilege(r.oid, c.oid, 'INSERT') ELSE NULL END,
        'update', CASE WHEN c.relkind = 'S' THEN pg_catalog.has_sequence_privilege(r.oid, c.oid, 'UPDATE') ELSE pg_catalog.has_table_privilege(r.oid, c.oid, 'UPDATE') END,
        'delete', CASE WHEN c.relkind <> 'S' THEN pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE') ELSE NULL END,
        'truncate', CASE WHEN c.relkind <> 'S' THEN pg_catalog.has_table_privilege(r.oid, c.oid, 'TRUNCATE') ELSE NULL END,
        'sequence_usage', CASE WHEN c.relkind = 'S' THEN pg_catalog.has_sequence_privilege(r.oid, c.oid, 'USAGE') ELSE NULL END,
        'column_privileges', CASE WHEN c.relkind <> 'S' THEN (
          SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'column', a.attname,
            'select', pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT'),
            'insert', pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, 'INSERT'),
            'update', pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, 'UPDATE')
          ) ORDER BY a.attnum), '[]'::jsonb)
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND a.attnum <= 128 AND NOT a.attisdropped
            AND (pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT')
              OR pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, 'INSERT')
              OR pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, 'UPDATE'))
        ) ELSE NULL END
      ) ORDER BY r.rolname) FROM subjects r)
    ) ORDER BY c.nspname, c.relname) FROM relations c
  ), '[]'::jsonb),
  'policies', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', p.nspname, 'table', p.relname, 'name', p.polname,
      'command', p.polcmd, 'permissive', p.polpermissive,
      'roles', (SELECT pg_catalog.jsonb_agg(CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(role_oid)::text END ORDER BY role_oid) FROM pg_catalog.unnest(p.polroles) role_oid),
      'qual_tree_sha256', CASE WHEN p.polqual IS NOT NULL THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.polqual::text, 'UTF8')), 'hex') ELSE NULL END,
      'check_tree_sha256', CASE WHEN p.polwithcheck IS NOT NULL THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.polwithcheck::text, 'UTF8')), 'hex') ELSE NULL END
    ) ORDER BY p.nspname, p.relname, p.polname) FROM policies p
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', p.nspname, 'name', p.proname, 'arguments', p.arguments,
      'owner', pg_catalog.pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
      'execute_roles', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role', r.rolname, 'execute', pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')) ORDER BY r.rolname) FROM subjects r)
    ) ORDER BY p.nspname, p.proname, p.arguments) FROM functions p
  ), '[]'::jsonb),
  'default_acl', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'creator', pg_catalog.pg_get_userbyid(d.defaclrole),
      'schema', COALESCE(n.nspname, '(all schemas)'), 'object_type', d.defaclobjtype,
      'grantee', CASE WHEN d.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(d.grantee)::text END,
      'privilege', d.privilege_type, 'grantable', d.is_grantable
    ) ORDER BY d.defaclrole, d.defaclnamespace, d.defaclobjtype, d.grantee, d.privilege_type)
    FROM bounded_default_acl d
    LEFT JOIN user_schemas n ON n.oid = d.defaclnamespace
  ), '[]'::jsonb)
);
ROLLBACK;
