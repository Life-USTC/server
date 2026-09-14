-- Self-hosted observability is content-free and independent of any external
-- analytics provider. Feature rows are exact observations when the writer
-- accepts them; issue rows contain only bounded routing/status identifiers.
CREATE TABLE "FeatureOperationEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feature" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "authMode" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "errorClass" TEXT NOT NULL,
    "durationMs" DOUBLE PRECISION NOT NULL,
    "requestId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureOperationEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeatureOperationEvent_feature_check" CHECK ("feature" IN (
      'catalog.search',
      'catalog.course',
      'catalog.section',
      'catalog.teacher',
      'workspace.overview',
      'workspace.subscription',
      'workspace.homework',
      'community.section-homework'
    )),
    CONSTRAINT "FeatureOperationEvent_operation_check" CHECK ("operation" IN (
      'view',
      'list',
      'get',
      'search',
      'match',
      'create',
      'update',
      'delete',
      'set_completion',
      'import',
      'batch'
    )),
    CONSTRAINT "FeatureOperationEvent_protocol_check" CHECK ("protocol" IN (
      'web',
      'rest',
      'graphql',
      'mcp'
    )),
    CONSTRAINT "FeatureOperationEvent_surface_check" CHECK ("surface" IN (
      'web',
      'mcp',
      'unknown'
    )),
    CONSTRAINT "FeatureOperationEvent_authMode_check" CHECK ("authMode" IN (
      'anonymous',
      'session',
      'oauth',
      'unknown'
    )),
    CONSTRAINT "FeatureOperationEvent_outcome_check" CHECK ("outcome" IN (
      'success',
      'rejected',
      'error',
      'unknown'
    )),
    CONSTRAINT "FeatureOperationEvent_errorClass_check" CHECK ("errorClass" IN (
      'none',
      'invalid_input',
      'unauthorized',
      'forbidden',
      'not_found',
      'conflict',
      'rate_limited',
      'dependency',
      'internal',
      'unknown'
    )),
    CONSTRAINT "FeatureOperationEvent_durationMs_check" CHECK (
      "durationMs" >= 0 AND "durationMs" < 'Infinity'::double precision
    ),
    CONSTRAINT "FeatureOperationEvent_requestId_check" CHECK (
      "requestId" IS NULL OR "requestId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
);

CREATE TABLE "RuntimeIssueEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "requestId" TEXT,
    "route" TEXT,
    "status" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuntimeIssueEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RuntimeIssueEvent_level_check" CHECK ("level" IN ('warn', 'error')),
    CONSTRAINT "RuntimeIssueEvent_event_length_check" CHECK (char_length("event") BETWEEN 1 AND 96),
    CONSTRAINT "RuntimeIssueEvent_route_length_check" CHECK ("route" IS NULL OR char_length("route") BETWEEN 1 AND 160),
    CONSTRAINT "RuntimeIssueEvent_status_check" CHECK ("status" IS NULL OR "status" BETWEEN 100 AND 599),
    CONSTRAINT "RuntimeIssueEvent_requestId_check" CHECK (
      "requestId" IS NULL OR "requestId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
);

CREATE INDEX "FeatureOperationEvent_occurredAt_id_idx"
  ON "FeatureOperationEvent"("occurredAt", "id");
CREATE INDEX "FeatureOperationEvent_feature_protocol_occurredAt_idx"
  ON "FeatureOperationEvent"("feature", "protocol", "occurredAt");
CREATE INDEX "FeatureOperationEvent_outcome_occurredAt_idx"
  ON "FeatureOperationEvent"("outcome", "occurredAt");
CREATE INDEX "FeatureOperationEvent_userId_occurredAt_idx"
  ON "FeatureOperationEvent"("userId", "occurredAt");
CREATE INDEX "RuntimeIssueEvent_occurredAt_id_idx"
  ON "RuntimeIssueEvent"("occurredAt", "id");
CREATE INDEX "RuntimeIssueEvent_event_occurredAt_idx"
  ON "RuntimeIssueEvent"("event", "occurredAt");

ALTER TABLE "FeatureOperationEvent"
  ADD CONSTRAINT "FeatureOperationEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Both tables are append-only to the application. Runtime insertion is
-- granted separately below; reads are visible only inside an admin RLS
-- context. FORCE keeps the contract true for a non-BYPASSRLS runtime role.
ALTER TABLE "FeatureOperationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureOperationEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RuntimeIssueEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RuntimeIssueEvent" FORCE ROW LEVEL SECURITY;

CREATE POLICY "FeatureOperationEvent_append_only"
  ON "FeatureOperationEvent"
  FOR INSERT TO PUBLIC
  WITH CHECK (true);
CREATE POLICY "FeatureOperationEvent_admin_reader"
  ON "FeatureOperationEvent"
  FOR SELECT TO PUBLIC
  USING (
    EXISTS (
      SELECT 1
      FROM "User" AS app_user
      WHERE app_user."id" = NULLIF(current_setting('app.user_id', true), '')
        AND app_user."isAdmin" = true
    )
  );

CREATE POLICY "RuntimeIssueEvent_append_only"
  ON "RuntimeIssueEvent"
  FOR INSERT TO PUBLIC
  WITH CHECK (true);
CREATE POLICY "RuntimeIssueEvent_admin_reader"
  ON "RuntimeIssueEvent"
  FOR SELECT TO PUBLIC
  USING (
    EXISTS (
      SELECT 1
      FROM "User" AS app_user
      WHERE app_user."id" = NULLIF(current_setting('app.user_id', true), '')
        AND app_user."isAdmin" = true
    )
  );

-- Retention is deliberately bounded and safe to repeat. The function owner is
-- granted a policy only for this maintenance path, while no application role
-- receives UPDATE or DELETE privileges.
CREATE FUNCTION public.maintain_observability_event_retention(
  p_now timestamp(3) without time zone,
  p_batch_size integer
)
RETURNS TABLE (
  feature_rows_deleted bigint,
  issue_rows_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_feature_rows_deleted bigint;
  v_issue_rows_deleted bigint;
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'now must not be null' USING ERRCODE = '22004';
  END IF;
  IF p_now > (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'now must not be in the future' USING ERRCODE = '22023';
  END IF;
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 1000 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS (
    SELECT source."id"
    FROM public."FeatureOperationEvent" AS source
    WHERE source."occurredAt" < p_now - interval '90 days'
    ORDER BY source."occurredAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."FeatureOperationEvent" AS target
  USING candidates
  WHERE target."id" = candidates."id";
  GET DIAGNOSTICS v_feature_rows_deleted = ROW_COUNT;

  WITH candidates AS (
    SELECT source."id"
    FROM public."RuntimeIssueEvent" AS source
    WHERE source."occurredAt" < p_now - interval '90 days'
    ORDER BY source."occurredAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."RuntimeIssueEvent" AS target
  USING candidates
  WHERE target."id" = candidates."id";
  GET DIAGNOSTICS v_issue_rows_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_feature_rows_deleted, v_issue_rows_deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.maintain_observability_event_retention(
  timestamp without time zone,
  integer
) FROM PUBLIC;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public."FeatureOperationEvent", public."RuntimeIssueEvent" TO life_ustc_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    EXECUTE 'GRANT SELECT, UPDATE, DELETE ON TABLE public."FeatureOperationEvent", public."RuntimeIssueEvent" TO life_ustc_function_owner';
    EXECUTE 'DROP POLICY IF EXISTS "FeatureOperationEvent_function_owner" ON public."FeatureOperationEvent"';
    EXECUTE 'CREATE POLICY "FeatureOperationEvent_function_owner" ON public."FeatureOperationEvent" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "RuntimeIssueEvent_function_owner" ON public."RuntimeIssueEvent"';
    EXECUTE 'CREATE POLICY "RuntimeIssueEvent_function_owner" ON public."RuntimeIssueEvent" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    EXECUTE 'ALTER FUNCTION public.maintain_observability_event_retention(timestamp without time zone, integer) OWNER TO life_ustc_function_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_maintenance_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.maintain_observability_event_retention(timestamp without time zone, integer) TO life_ustc_maintenance_runtime';
  END IF;
END
$roles$;
