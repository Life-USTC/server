\set ON_ERROR_STOP on

-- Exercise the exact deployment grants and policies, with disposable credentials.
SELECT current_database() AS database_name \gset
\set app_password 'runtime-test-password'
\set auth_password 'auth-runtime-test-password'
\set maintenance_password 'maintenance-runtime-test-password'
\ir ../../../prisma/roles/production-runtime-bootstrap.sql
