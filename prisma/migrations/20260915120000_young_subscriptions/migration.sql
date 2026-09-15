CREATE TABLE "UserYoungEventSubscription" (
  "id" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL, "youngId" TEXT NOT NULL,
  "remindSignup" BOOLEAN NOT NULL DEFAULT true,
  "remindDeadline" BOOLEAN NOT NULL DEFAULT true,
  "remindStart" BOOLEAN NOT NULL DEFAULT true,
  "observedState" TEXT NOT NULL, "observedRevision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "youngId"),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("youngId") REFERENCES "YoungEvent"("youngId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "UserYoungEventSubscription_youngId_idx" ON "UserYoungEventSubscription"("youngId");
CREATE TABLE "UserYoungOrganizerSubscription" (
  "userId" TEXT NOT NULL, "organizerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "organizerId"),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("organizerId") REFERENCES "YoungOrganizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "UserYoungOrganizerSubscription_organizerId_idx" ON "UserYoungOrganizerSubscription"("organizerId");
CREATE TABLE "YoungNotification" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
  "youngId" TEXT, "organizerId" TEXT, "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL, "body" TEXT NOT NULL, "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "YoungNotification_userId_dedupeKey_key" ON "YoungNotification"("userId", "dedupeKey");
CREATE INDEX "YoungNotification_userId_createdAt_id_idx" ON "YoungNotification"("userId", "createdAt", "id");
ALTER TABLE "UserYoungEventSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserYoungEventSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY "UserYoungEventSubscription_owner_isolation" ON "UserYoungEventSubscription" FOR ALL
  USING ("userId" = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.user_id', true), ''));
ALTER TABLE "UserYoungOrganizerSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserYoungOrganizerSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY "UserYoungOrganizerSubscription_owner_isolation" ON "UserYoungOrganizerSubscription" FOR ALL
  USING ("userId" = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.user_id', true), ''));
ALTER TABLE "YoungNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "YoungNotification" FORCE ROW LEVEL SECURITY;
CREATE POLICY "YoungNotification_owner_isolation" ON "YoungNotification" FOR ALL
  USING ("userId" = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE FUNCTION public.list_young_notification_recipients(after_id text, batch_size integer)
RETURNS TABLE (id text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT recipients."userId" FROM (
    SELECT "userId" FROM public."UserYoungEventSubscription"
    UNION SELECT "userId" FROM public."UserYoungOrganizerSubscription"
  ) recipients WHERE after_id IS NULL OR recipients."userId" > after_id
  ORDER BY recipients."userId" LIMIT LEAST(GREATEST(batch_size, 1), 100);
$$;
REVOKE ALL ON FUNCTION public.list_young_notification_recipients(text, integer) FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "UserYoungEventSubscription", "UserYoungOrganizerSubscription", "YoungNotification" TO life_ustc_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    GRANT SELECT ("userId") ON "UserYoungEventSubscription", "UserYoungOrganizerSubscription" TO life_ustc_function_owner;
    CREATE POLICY "UserYoungEventSubscription_recipients" ON "UserYoungEventSubscription" FOR SELECT TO life_ustc_function_owner USING (true);
    CREATE POLICY "UserYoungOrganizerSubscription_recipients" ON "UserYoungOrganizerSubscription" FOR SELECT TO life_ustc_function_owner USING (true);
    ALTER FUNCTION public.list_young_notification_recipients(text, integer) OWNER TO life_ustc_function_owner;
    REVOKE EXECUTE ON FUNCTION public.list_young_notification_recipients(text, integer) FROM life_ustc_function_owner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_maintenance_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.list_young_notification_recipients(text, integer) TO life_ustc_maintenance_runtime;
  END IF;
END
$grants$;
