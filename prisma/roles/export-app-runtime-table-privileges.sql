\set ON_ERROR_STOP on

-- Emit the comma-separated table privilege allowlist used by verify-app-runtime.sql.
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
FROM (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname,
    acl.privilege_type,
    acl.grantee
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(
    relation.relacl,
    acldefault('r', relation.relowner)
  )) AS acl
  WHERE namespace.nspname <> 'information_schema'
    AND namespace.nspname !~ '^pg_'
    AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
) AS relation_acl
WHERE relation_acl.grantee = (
  SELECT oid FROM pg_roles WHERE rolname = current_user
);
