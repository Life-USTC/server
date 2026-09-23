BEGIN;

-- `20260802120000` revoked EXECUTE on `comment_hidden_root_count` from PUBLIC,
-- expecting `prisma/roles/production-runtime-bootstrap.sql` to hand the app role
-- an explicit grant. Where that bootstrap has not been re-run since the function
-- was created, `life_ustc_runtime` lost the implicit PUBLIC grant and never
-- gained its own, so every anonymous comment list failed with Prisma P2010
-- (raw query failed) on `SELECT public.comment_hidden_root_count(...)`.
--
-- 20260802120000 is already recorded as applied, so it will not re-run; this
-- migration carries the grant instead. It is idempotent and safe on databases
-- that already have it.
DO $do$
DECLARE
  fn_signature CONSTANT text :=
    'public.comment_hidden_root_count(integer, integer, integer, text, integer)';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'comment_hidden_root_count'
  ) THEN
    RAISE NOTICE 'comment_hidden_root_count is absent; nothing to grant.';
    RETURN;
  END IF;

  -- Only the function owner may change its privileges. Once the roles bootstrap
  -- has transferred ownership to `life_ustc_function_owner` it also issues this
  -- grant, so skipping here is correct rather than a silent failure.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'comment_hidden_root_count'
      AND pg_get_userbyid(p.proowner) = current_user
  ) THEN
    RAISE NOTICE
      'comment_hidden_root_count is not owned by %; leaving privileges to the roles bootstrap.',
      current_user;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO life_ustc_runtime', fn_signature);
  END IF;

  -- The definer reads `Comment`, which has FORCE ROW LEVEL SECURITY, and no
  -- other policy exposes `logged_in_only` rows. `20260802120000` bound this
  -- policy with `TO CURRENT_USER`, which is the migrator rather than whichever
  -- role ends up owning the function, so re-point it at the current owner.
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Comment_hidden_count_reader')
  THEN
    EXECUTE format(
      'ALTER POLICY "Comment_hidden_count_reader" ON "Comment" TO %I',
      current_user
    );
  ELSE
    EXECUTE format(
      'CREATE POLICY "Comment_hidden_count_reader" ON "Comment"'
      || ' FOR SELECT TO %I USING (true)',
      current_user
    );
  END IF;
END
$do$;

COMMIT;
