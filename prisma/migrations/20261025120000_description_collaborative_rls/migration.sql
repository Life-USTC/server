-- Descriptions remain public and collaborative; writes require a live actor.
ALTER TABLE public."Description" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Description" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."DescriptionEdit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DescriptionEdit" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Description_public_read" ON public."Description"
FOR SELECT USING (true);

CREATE POLICY "Description_active_insert" ON public."Description"
FOR INSERT WITH CHECK (
  "lastEditedById" = NULLIF(current_setting('app.user_id', true), '')
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

CREATE POLICY "Description_active_update" ON public."Description"
FOR UPDATE USING (
  EXISTS (
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
  "lastEditedById" = NULLIF(current_setting('app.user_id', true), '')
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

CREATE POLICY "DescriptionEdit_public_read" ON public."DescriptionEdit"
FOR SELECT USING (true);

CREATE POLICY "DescriptionEdit_active_insert" ON public."DescriptionEdit"
FOR INSERT WITH CHECK (
  "editorId" = NULLIF(current_setting('app.user_id', true), '')
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

-- Existing deployments already have table-wide UPDATE/DELETE grants. Narrow
-- them in the migration as well as the fresh-database role bootstrap.
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    REVOKE UPDATE, DELETE ON TABLE public."Description" FROM life_ustc_runtime;
    GRANT UPDATE ("content", "lastEditedAt", "lastEditedById", "updatedAt")
    ON TABLE public."Description" TO life_ustc_runtime;
  END IF;
END;
$roles$;
