-- Prometheus reads one short-lived, sanitized aggregate snapshot. The app
-- runtime receives only EXECUTE on the SECURITY DEFINER function; raw source
-- rows and the cache table remain outside its table privileges.
CREATE TABLE "PrometheusMetricsCache" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrometheusMetricsCache_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrometheusMetricsCache_singleton_check" CHECK ("id" = 1)
);

ALTER TABLE "PrometheusMetricsCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrometheusMetricsCache" FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.read_prometheus_metrics_snapshot()
RETURNS TABLE (
  "generatedAt" timestamp(3) without time zone,
  payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamp(3) := (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3);
  v_cached_generated_at timestamp(3);
  v_cached_payload jsonb;
  v_first_feature_recorded_at timestamp(3);
  v_summary jsonb;
  v_users jsonb;
  v_features jsonb;
  v_audit jsonb;
  v_oauth jsonb;
  v_oauth_summary jsonb;
  v_runtime jsonb;
BEGIN
  SELECT cache."generatedAt", cache."payload"
  INTO v_cached_generated_at, v_cached_payload
  FROM public."PrometheusMetricsCache" AS cache
  WHERE cache."id" = 1;

  IF FOUND AND v_cached_generated_at >= v_now - interval '60 seconds' THEN
    RETURN QUERY SELECT v_cached_generated_at, v_cached_payload;
    RETURN;
  END IF;

  -- Scrapes are independent requests. Only one may refresh the singleton;
  -- callers that arrive while it is refreshing may use a two-minute snapshot.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('life-ustc.prometheus-metrics-cache', 0)
  ) THEN
    IF FOUND AND v_cached_generated_at >= v_now - interval '120 seconds' THEN
      RETURN QUERY SELECT v_cached_generated_at, v_cached_payload;
      RETURN;
    END IF;
    RAISE EXCEPTION 'prometheus metrics snapshot refresh is busy'
      USING ERRCODE = '55P03';
  END IF;

  -- Recheck after taking the lock in case another refresh committed between
  -- the first read and the advisory lock attempt.
  SELECT cache."generatedAt", cache."payload"
  INTO v_cached_generated_at, v_cached_payload
  FROM public."PrometheusMetricsCache" AS cache
  WHERE cache."id" = 1
  FOR UPDATE;
  IF FOUND AND v_cached_generated_at >= v_now - interval '60 seconds' THEN
    RETURN QUERY SELECT v_cached_generated_at, v_cached_payload;
    RETURN;
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'users', pg_catalog.count(*)
  )
  INTO v_summary
  FROM public."User";

  SELECT pg_catalog.min(feature."occurredAt")
  INTO v_first_feature_recorded_at
  FROM public."FeatureOperationEvent" AS feature
  WHERE feature."occurredAt" <= v_now;

  v_summary := v_summary || pg_catalog.jsonb_build_object(
    'comments', (SELECT pg_catalog.count(*) FROM public."Comment"),
    'homeworks', (SELECT pg_catalog.count(*) FROM public."Homework"),
    'oauth_clients', (SELECT pg_catalog.count("clientId") FROM public."OAuthClient"),
    'active_suspensions', (
      SELECT pg_catalog.count(*)
      FROM public."UserSuspension"
      WHERE "liftedAt" IS NULL
    )
  );

  WITH windows(name, start_at) AS (
    VALUES
      (
        'today'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours'
      ),
      (
        '7d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '6 days'
      ),
      (
        '30d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '29 days'
      )
  )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source) ORDER BY source.window),
    '[]'::jsonb
  )
  INTO v_users
  FROM (
    SELECT
      windows.name AS window,
      pg_catalog.count(account."id")::bigint AS registered_users,
      CASE
        WHEN v_first_feature_recorded_at IS NULL THEN NULL
        ELSE (
          SELECT pg_catalog.count(DISTINCT feature."userId")::bigint
          FROM public."FeatureOperationEvent" AS feature
          WHERE feature."userId" IS NOT NULL
            AND feature."occurredAt" >= windows.start_at
            AND feature."occurredAt" <= v_now
        )
      END AS active_users
    FROM windows
    LEFT JOIN public."User" AS account
      ON account."createdAt" >= windows.start_at
      AND account."createdAt" <= v_now
    GROUP BY windows.name, windows.start_at
  ) AS source;

  WITH windows(name, start_at) AS (
    VALUES
      ('5m'::text, v_now - interval '5 minutes'),
      (
        'today'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours'
      ),
      (
        '7d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '6 days'
      ),
      (
        '30d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '29 days'
      )
  )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source) ORDER BY source.window, source.feature, source.operation, source.protocol, source.surface, source.auth_mode, source.outcome, source.error_class),
    '[]'::jsonb
  )
  INTO v_features
  FROM (
    SELECT
      windows.name AS window,
      tuples.feature,
      tuples.operation,
      tuples.protocol,
      tuples.surface,
      tuples.auth_mode,
      tuples.outcome,
      tuples.error_class,
      pg_catalog.count(feature."id")::bigint AS events,
      pg_catalog.count(DISTINCT feature."userId")::bigint AS users,
      COALESCE(
        (pg_catalog.sum(feature."durationMs") / 1000.0)::double precision,
        0.0::double precision
      ) AS duration_seconds,
      COALESCE(
        (pg_catalog.max(feature."durationMs") / 1000.0)::double precision,
        0.0::double precision
      ) AS max_duration_seconds
    FROM windows
    CROSS JOIN (
      SELECT DISTINCT
        feature.feature,
        feature.operation,
        feature.protocol,
        feature.surface,
        feature."authMode" AS auth_mode,
        feature.outcome,
        feature."errorClass" AS error_class
      FROM public."FeatureOperationEvent" AS feature
      WHERE feature."occurredAt" >= (
        pg_catalog.date_trunc('day', v_now + interval '8 hours')
        - interval '8 hours' - interval '29 days'
      )
        AND feature."occurredAt" <= v_now
    ) AS tuples
    LEFT JOIN public."FeatureOperationEvent" AS feature
      ON feature.feature = tuples.feature
      AND feature.operation = tuples.operation
      AND feature.protocol = tuples.protocol
      AND feature.surface = tuples.surface
      AND feature."authMode" = tuples.auth_mode
      AND feature.outcome = tuples.outcome
      AND feature."errorClass" = tuples.error_class
      AND feature."occurredAt" >= windows.start_at
      AND feature."occurredAt" <= v_now
    GROUP BY
      windows.name,
      tuples.feature,
      tuples.operation,
      tuples.protocol,
      tuples.surface,
      tuples.auth_mode,
      tuples.outcome,
      tuples.error_class
  ) AS source;

  WITH windows(name, start_at) AS (
    VALUES
      (
        'today'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours'
      ),
      (
        '7d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '6 days'
      ),
      (
        '30d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '29 days'
      )
  )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source) ORDER BY source.window, source.action, source.channel, source.outcome),
    '[]'::jsonb
  )
  INTO v_audit
  FROM (
    SELECT
      windows.name AS window,
      audit.action::text AS action,
      audit.channel::text AS channel,
      audit.outcome::text AS outcome,
      pg_catalog.count(*)::bigint AS events
    FROM windows
    JOIN public."AuditLog" AS audit
      ON audit."createdAt" >= windows.start_at
      AND audit."createdAt" <= v_now
    WHERE audit."oauthClientId" IS NULL
      OR audit.channel::text NOT IN ('rest', 'graphql', 'mcp')
    GROUP BY windows.name, audit.action, audit.channel, audit.outcome
  ) AS source;

  WITH windows(name, start_day, end_day) AS (
    VALUES
      (
        'today'::text,
        (v_now + interval '8 hours')::date,
        (v_now + interval '8 hours')::date
      ),
      (
        '7d'::text,
        (v_now + interval '8 hours')::date - 6,
        (v_now + interval '8 hours')::date
      ),
      (
        '30d'::text,
        (v_now + interval '8 hours')::date - 29,
        (v_now + interval '8 hours')::date
      )
    ), normalized AS (
      SELECT
        usage."day",
        usage.channel::text AS channel,
        CASE usage.feature
          WHEN 'account.client-activity' THEN usage.feature
          WHEN 'account.profile' THEN usage.feature
          WHEN 'catalog.bus' THEN usage.feature
          WHEN 'catalog.course' THEN usage.feature
          WHEN 'catalog.exam' THEN usage.feature
          WHEN 'catalog.link' THEN usage.feature
          WHEN 'catalog.schedule' THEN usage.feature
          WHEN 'catalog.section' THEN usage.feature
          WHEN 'catalog.teacher' THEN usage.feature
          WHEN 'community.comment' THEN usage.feature
          WHEN 'community.description' THEN usage.feature
          WHEN 'community.section-homework' THEN usage.feature
          WHEN 'community.user' THEN usage.feature
          WHEN 'workspace.bus-preferences' THEN usage.feature
          WHEN 'workspace.calendar' THEN usage.feature
          WHEN 'workspace.calendar-feed' THEN usage.feature
          WHEN 'workspace.exam' THEN usage.feature
          WHEN 'workspace.homework' THEN usage.feature
          WHEN 'workspace.link-pin' THEN usage.feature
          WHEN 'workspace.overview' THEN usage.feature
          WHEN 'workspace.schedule' THEN usage.feature
          WHEN 'workspace.subscription' THEN usage.feature
          WHEN 'workspace.todo' THEN usage.feature
          WHEN 'workspace.upload' THEN usage.feature
          WHEN 'admin' THEN usage.feature
          ELSE 'unknown'
        END AS feature,
        usage."readCount" AS read_count,
        usage."writeCount" AS write_count,
        usage."errorCount" AS error_count
      FROM public."OAuthGrantUsageDaily" AS usage
    )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source) ORDER BY source.window, source.channel, source.feature),
    '[]'::jsonb
  )
  INTO v_oauth
  FROM (
    SELECT
      windows.name AS window,
      normalized.channel,
      normalized.feature,
      pg_catalog.sum(normalized.read_count)::bigint AS read_count,
      pg_catalog.sum(normalized.write_count)::bigint AS write_count,
      pg_catalog.sum(normalized.error_count)::bigint AS error_count
    FROM windows
    JOIN normalized
      ON normalized."day" >= windows.start_day
      AND normalized."day" <= windows.end_day
    GROUP BY windows.name, normalized.channel, normalized.feature
  ) AS source;

  WITH windows(name, start_day, end_day) AS (
    VALUES
      (
        'today'::text,
        (v_now + interval '8 hours')::date,
        (v_now + interval '8 hours')::date
      ),
      (
        '7d'::text,
        (v_now + interval '8 hours')::date - 6,
        (v_now + interval '8 hours')::date
      ),
      (
        '30d'::text,
        (v_now + interval '8 hours')::date - 29,
        (v_now + interval '8 hours')::date
      )
  )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source) ORDER BY source.window),
    '[]'::jsonb
  )
  INTO v_oauth_summary
  FROM (
    SELECT
      windows.name AS window,
      pg_catalog.count(DISTINCT usage."clientId")::bigint AS active_clients
    FROM windows
    LEFT JOIN public."OAuthGrantUsageDaily" AS usage
      ON usage."day" >= windows.start_day
      AND usage."day" <= windows.end_day
    GROUP BY windows.name
  ) AS source;

  WITH windows(name, start_at) AS (
    VALUES
      ('5m'::text, v_now - interval '5 minutes'),
      (
        'today'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours'
      ),
      (
        '7d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '6 days'
      ),
      (
        '30d'::text,
        pg_catalog.date_trunc('day', v_now + interval '8 hours') - interval '8 hours' - interval '29 days'
      )
  ), normalized AS (
    SELECT
      windows.name,
      issue.level,
      CASE
        WHEN issue.event LIKE 'admin.%' THEN 'admin'
        WHEN issue.event LIKE 'audit-%' THEN 'audit'
        WHEN issue.event LIKE 'calendar-%' THEN 'calendar'
        WHEN issue.event LIKE 'edge.%' THEN 'edge'
        WHEN issue.event LIKE 'graphql.%' THEN 'graphql'
        WHEN issue.event LIKE 'oauth.%' THEN 'oauth'
        WHEN issue.event LIKE 'page.%' THEN 'page'
        WHEN issue.event LIKE 'postgres.%' THEN 'database'
        WHEN issue.event LIKE 'prisma.%' THEN 'database'
        WHEN issue.event LIKE 'request.%' THEN 'request'
        WHEN issue.event LIKE 'scheduled.%' THEN 'scheduled'
        WHEN issue.event LIKE 'search.%' THEN 'search'
        WHEN issue.event LIKE 'sveltekit.%' THEN 'sveltekit'
        WHEN issue.event LIKE 'upload-%' THEN 'upload'
        WHEN issue.event LIKE 'user-%' THEN 'security'
        WHEN issue.event LIKE 'worker.%' THEN 'worker'
        WHEN issue.event LIKE 'workspace.%' THEN 'workspace'
        ELSE 'other'
      END AS event,
      CASE
        WHEN issue.status IS NULL THEN 'none'
        WHEN issue.status >= 500 THEN '5xx'
        WHEN issue.status >= 400 THEN '4xx'
        WHEN issue.status >= 300 THEN '3xx'
        WHEN issue.status >= 200 THEN '2xx'
        ELSE '1xx'
      END AS status
    FROM windows
    JOIN public."RuntimeIssueEvent" AS issue
      ON issue."occurredAt" >= windows.start_at
      AND issue."occurredAt" <= v_now
  )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source) ORDER BY source.window, source.level, source.event, source.status),
    '[]'::jsonb
  )
  INTO v_runtime
  FROM (
    SELECT name AS window, level, event, status, pg_catalog.count(*)::bigint AS events
    FROM normalized
    GROUP BY name, level, event, status
  ) AS source;

  v_cached_payload := pg_catalog.jsonb_build_object(
    'schema_version', 1,
    'first_feature_recorded_at', CASE
      WHEN v_first_feature_recorded_at IS NULL THEN NULL
      ELSE pg_catalog.to_char(
        v_first_feature_recorded_at,
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    END,
    'summary', v_summary,
    'users', v_users,
    'features', v_features,
    'audit', v_audit,
    'oauth', v_oauth,
    'oauth_summary', v_oauth_summary,
    'runtime', v_runtime
  );

  INSERT INTO public."PrometheusMetricsCache" AS cache (
    "id", "generatedAt", "payload", "createdAt", "updatedAt"
  ) VALUES (1, v_now, v_cached_payload, v_now, v_now)
  ON CONFLICT ("id") DO UPDATE SET
    "generatedAt" = EXCLUDED."generatedAt",
    "payload" = EXCLUDED."payload",
    "updatedAt" = EXCLUDED."updatedAt"
  RETURNING cache."generatedAt", cache."payload"
  INTO v_cached_generated_at, v_cached_payload;

  RETURN QUERY SELECT v_cached_generated_at, v_cached_payload;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.read_prometheus_metrics_snapshot() FROM PUBLIC;

DO $roles$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner'
  ) THEN
    EXECUTE 'GRANT SELECT ON TABLE public."User", public."Comment", public."Homework", public."OAuthClient", public."UserSuspension", public."AuditLog", public."OAuthGrantUsageDaily", public."FeatureOperationEvent", public."RuntimeIssueEvent" TO life_ustc_function_owner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public."PrometheusMetricsCache" TO life_ustc_function_owner';
    EXECUTE 'DROP POLICY IF EXISTS "PrometheusMetricsCache_function_owner" ON public."PrometheusMetricsCache"';
    EXECUTE 'CREATE POLICY "PrometheusMetricsCache_function_owner" ON public."PrometheusMetricsCache" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = 'public."Comment"'::pg_catalog.regclass
        AND polname = 'Comment_hidden_count_reader'
    ) THEN
      EXECUTE 'ALTER POLICY "Comment_hidden_count_reader" ON public."Comment" TO life_ustc_function_owner';
    ELSE
      EXECUTE 'CREATE POLICY "Comment_hidden_count_reader" ON public."Comment" FOR SELECT TO life_ustc_function_owner USING (true)';
    END IF;
    EXECUTE 'DROP POLICY IF EXISTS "AuditLog_function_owner" ON public."AuditLog"';
    EXECUTE 'CREATE POLICY "AuditLog_function_owner" ON public."AuditLog" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "OAuthGrantUsageDaily_function_owner" ON public."OAuthGrantUsageDaily"';
    EXECUTE 'CREATE POLICY "OAuthGrantUsageDaily_function_owner" ON public."OAuthGrantUsageDaily" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "FeatureOperationEvent_function_owner" ON public."FeatureOperationEvent"';
    EXECUTE 'CREATE POLICY "FeatureOperationEvent_function_owner" ON public."FeatureOperationEvent" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "RuntimeIssueEvent_function_owner" ON public."RuntimeIssueEvent"';
    EXECUTE 'CREATE POLICY "RuntimeIssueEvent_function_owner" ON public."RuntimeIssueEvent" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    EXECUTE 'ALTER FUNCTION public.read_prometheus_metrics_snapshot() OWNER TO life_ustc_function_owner';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.read_prometheus_metrics_snapshot() TO life_ustc_runtime';
  END IF;
END
$roles$;
