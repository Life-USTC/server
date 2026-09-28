-- Comment writes materialize verified section/teacher targets and reactivate
-- retired targets. No existing target identity or catalog assignment is mutable.
DO $grant_comment_target$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT INSERT ON TABLE public."SectionTeacher" TO life_ustc_runtime;
    GRANT UPDATE ("retiredAt", "updatedAt") ON TABLE public."SectionTeacher"
      TO life_ustc_runtime;
  END IF;
END
$grant_comment_target$;
