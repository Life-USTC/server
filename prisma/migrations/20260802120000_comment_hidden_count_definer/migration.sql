BEGIN;

-- FORCE RLS applies to the function owner too. This policy is bound to the
-- migration owner and activated only by the hidden-count helper below.
CREATE POLICY "Comment_hidden_count_reader" ON "Comment"
  FOR SELECT
  TO CURRENT_USER
  USING (true);

REVOKE ALL
  ON FUNCTION public.comment_hidden_root_count(
    integer,
    integer,
    integer,
    text,
    integer
  )
  FROM PUBLIC;

COMMIT;
