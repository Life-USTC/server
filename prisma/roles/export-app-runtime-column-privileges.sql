\set ON_ERROR_STOP on

-- Emit the comma-separated column privilege allowlist used by verify-app-runtime.sql.
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
FROM (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname,
    attribute.attname,
    acl.privilege_type,
    acl.grantee
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  JOIN pg_attribute AS attribute
    ON attribute.attrelid = relation.oid
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
  CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
  WHERE namespace.nspname <> 'information_schema'
    AND namespace.nspname !~ '^pg_'
) AS column_acl
WHERE column_acl.grantee = (
  SELECT oid FROM pg_roles WHERE rolname = current_user
);
