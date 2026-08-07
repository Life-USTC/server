BEGIN;

-- `comment_reaction_summaries` / `comment_attachment_summaries` revoke EXECUTE
-- from PUBLIC when created. Production bootstrap grants them to
-- `life_ustc_runtime`, but where that bootstrap has not been re-run since the
-- functions were introduced the app role never received EXECUTE. Comment list
-- then fails with Prisma P2010 (raw query failed) on every thread that hits
-- the summary helpers.
--
-- Prefer an unconditional GRANT when we can. If ownership already moved to
-- `life_ustc_function_owner` and the migrator lacks privilege, notice and leave
-- the roles bootstrap responsible (same pattern as comment_hidden_root_count).

DO $do$
DECLARE
  reaction_signature CONSTANT text :=
    'public.comment_reaction_summaries(text[])';
  attachment_signature CONSTANT text :=
    'public.comment_attachment_summaries(text[])';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    RAISE NOTICE
      'Skipping comment summary grants; role life_ustc_runtime does not exist.';
    RETURN;
  END IF;

  IF to_regprocedure(reaction_signature) IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO life_ustc_runtime',
        reaction_signature
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE
          'Could not GRANT EXECUTE on comment_reaction_summaries; re-run roles bootstrap.';
    END;
  END IF;

  IF to_regprocedure(attachment_signature) IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO life_ustc_runtime',
        attachment_signature
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE
          'Could not GRANT EXECUTE on comment_attachment_summaries; re-run roles bootstrap.';
    END;
  END IF;

  -- Definer policies created as TO CURRENT_USER (the migrator) must follow the
  -- current owner so SECURITY DEFINER helpers keep reading under FORCE RLS.
  IF EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'CommentReaction_summary_reader'
  ) THEN
    BEGIN
      EXECUTE format(
        'ALTER POLICY "CommentReaction_summary_reader" ON "CommentReaction" TO %I',
        current_user
      );
    EXCEPTION
      WHEN insufficient_privilege OR undefined_object THEN
        RAISE NOTICE
          'Could not retarget CommentReaction_summary_reader; leaving to roles bootstrap.';
    END;
  END IF;
END
$do$;

COMMIT;
