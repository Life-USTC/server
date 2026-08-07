BEGIN;

-- `comment_reaction_summaries` / `comment_attachment_summaries` revoke EXECUTE
-- from PUBLIC when created. Production bootstrap grants them to
-- `life_ustc_runtime`, but where that bootstrap has not been re-run since the
-- functions were introduced the app role never received EXECUTE. Comment list
-- then fails with Prisma P2010 (raw query failed) on every thread that hits
-- the summary helpers.
--
-- Mirror `20260803120000_comment_hidden_count_runtime_grant`: only change
-- privileges / definer policies while the migrator still owns the helpers.
-- After `production-runtime-bootstrap.sql` moves ownership to
-- `life_ustc_function_owner` (and retargets policies there), skipping here is
-- correct — a privileged migrator must not retarget those policies back to
-- itself.

DO $do$
DECLARE
  reaction_signature CONSTANT text :=
    'public.comment_reaction_summaries(text[])';
  attachment_signature CONSTANT text :=
    'public.comment_attachment_summaries(text[])';
  owns_reaction boolean := false;
  owns_attachment boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE
      'Skipping comment summary grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  owns_reaction :=
    to_regprocedure(reaction_signature) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'comment_reaction_summaries'
        AND pg_get_userbyid(p.proowner) = current_user
    );

  owns_attachment :=
    to_regprocedure(attachment_signature) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'comment_attachment_summaries'
        AND pg_get_userbyid(p.proowner) = current_user
    );

  IF to_regprocedure(reaction_signature) IS NOT NULL AND NOT owns_reaction THEN
    RAISE NOTICE
      'comment_reaction_summaries is not owned by %; leaving privileges to the roles bootstrap.',
      current_user;
  ELSIF owns_reaction THEN
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO life_ustc_runtime',
      reaction_signature
    );
  END IF;

  IF to_regprocedure(attachment_signature) IS NOT NULL AND NOT owns_attachment THEN
    RAISE NOTICE
      'comment_attachment_summaries is not owned by %; leaving privileges to the roles bootstrap.',
      current_user;
  ELSIF owns_attachment THEN
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO life_ustc_runtime',
      attachment_signature
    );
  END IF;

  -- Only retarget the summary-reader policy when we still own the reaction
  -- helper. Otherwise the policy is already (or must stay) bound to
  -- `life_ustc_function_owner` from the roles bootstrap.
  IF owns_reaction
    AND EXISTS (
      SELECT 1 FROM pg_policy WHERE polname = 'CommentReaction_summary_reader'
    )
  THEN
    EXECUTE format(
      'ALTER POLICY "CommentReaction_summary_reader" ON "CommentReaction" TO %I',
      current_user
    );
  END IF;
END
$do$;

COMMIT;
