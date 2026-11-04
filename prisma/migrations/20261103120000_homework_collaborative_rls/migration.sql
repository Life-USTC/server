-- Public shared homework keeps collaborative edits and creator/admin deletion.
ALTER TABLE public."Homework" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Homework" FORCE ROW LEVEL SECURITY;
CREATE POLICY "Homework_public_read" ON public."Homework" FOR SELECT USING (true);
CREATE POLICY "Homework_active_insert" ON public."Homework" FOR INSERT WITH CHECK (
  "createdById" = NULLIF(current_setting('app.user_id', true), '')
  AND "updatedById" = NULLIF(current_setting('app.user_id', true), '')
  AND "deletedAt" IS NULL AND "deletedById" IS NULL
  AND EXISTS (
    SELECT 1 FROM public."User" AS actor
    WHERE actor.id = NULLIF(current_setting('app.user_id', true), '')
      AND NOT EXISTS (
        SELECT 1 FROM public."UserSuspension" AS suspension
        WHERE suspension."userId" = actor.id
          AND suspension."liftedAt" IS NULL
          AND (suspension."expiresAt" IS NULL OR suspension."expiresAt" > (statement_timestamp() AT TIME ZONE 'UTC'))
      )
  )
);
CREATE POLICY "Homework_active_update" ON public."Homework" FOR UPDATE USING (
  "deletedAt" IS NULL AND EXISTS (
    SELECT 1 FROM public."User" AS actor
    WHERE actor.id = NULLIF(current_setting('app.user_id', true), '')
      AND NOT EXISTS (
        SELECT 1 FROM public."UserSuspension" AS suspension
        WHERE suspension."userId" = actor.id
          AND suspension."liftedAt" IS NULL
          AND (suspension."expiresAt" IS NULL OR suspension."expiresAt" > (statement_timestamp() AT TIME ZONE 'UTC'))
      )
  )
) WITH CHECK (
  "updatedById" = NULLIF(current_setting('app.user_id', true), '')
  AND EXISTS (
    SELECT 1 FROM public."User" AS actor
    WHERE actor.id = NULLIF(current_setting('app.user_id', true), '')
      AND NOT EXISTS (
        SELECT 1 FROM public."UserSuspension" AS suspension
        WHERE suspension."userId" = actor.id
          AND suspension."liftedAt" IS NULL
          AND (suspension."expiresAt" IS NULL OR suspension."expiresAt" > (statement_timestamp() AT TIME ZONE 'UTC'))
      )
  )
  AND (
    ("deletedAt" IS NULL AND "deletedById" IS NULL)
    OR (
      "deletedAt" IS NOT NULL
      AND "deletedById" = NULLIF(current_setting('app.user_id', true), '')
      AND (
        "createdById" = NULLIF(current_setting('app.user_id', true), '')
        OR EXISTS (SELECT 1 FROM public."User" AS actor
          WHERE actor.id = NULLIF(current_setting('app.user_id', true), '') AND actor."isAdmin")
      )
    )
  )
);

-- Retain target and creator identity, including on existing deployments.
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    REVOKE UPDATE ON TABLE public."Homework" FROM life_ustc_runtime;
    GRANT UPDATE ("title", "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "updatedAt", "updatedById", "deletedAt", "deletedById") ON TABLE public."Homework" TO life_ustc_runtime;
  END IF;
END;
$roles$;
