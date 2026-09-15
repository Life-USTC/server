BEGIN;

-- Persistent counters start here; retained logs are deliberately not backfilled.
-- Statement transition tables contain only successfully inserted rows, including
-- INSERT ... ON CONFLICT DO NOTHING, so replay cannot increment a second time.
CREATE TABLE public."PrometheusCounter" (
  kind text NOT NULL,
  labels text NOT NULL,
  value numeric(65,15) NOT NULL CHECK (value >= 0),
  PRIMARY KEY (kind, labels)
);
CREATE TABLE public."PrometheusCounterEpoch" (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "startedAt" timestamp(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
INSERT INTO public."PrometheusCounterEpoch" DEFAULT VALUES;
INSERT INTO public."PrometheusCounter" VALUES ('registrations', '{}', 0), ('deletions', '{}', 0);
ALTER TABLE public."PrometheusCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrometheusCounter" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."PrometheusCounterEpoch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrometheusCounterEpoch" FORCE ROW LEVEL SECURITY;
DELETE FROM public."PrometheusMetricsCache";

CREATE FUNCTION public.count_prometheus_features() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
BEGIN
  INSERT INTO public."PrometheusCounter" AS target (kind, labels, value)
  SELECT kind, labels, sum(value) FROM (SELECT 'features' AS kind, jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol,'surface',surface,'auth_mode',"authMode",'outcome',outcome)::text AS labels, 1::numeric AS value FROM new_rows
    UNION ALL
    SELECT 'feature_errors', jsonb_build_object('feature',feature,'protocol',protocol,'error_class',"errorClass")::text, 1 FROM new_rows WHERE outcome = 'error'
    UNION ALL
    SELECT 'duration_count', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, 1 FROM new_rows
    UNION ALL
    SELECT 'duration_sum', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, "durationMs"::numeric / 1000 FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_00', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 5 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_01', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 10 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_02', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 25 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_03', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 50 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_04', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 100 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_05', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 250 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_06', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 500 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_07', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 1000 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_08', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 2500 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_09', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 5000 THEN 1 ELSE 0 END FROM new_rows
    UNION ALL
    SELECT 'duration_bucket_10', jsonb_build_object('feature',feature,'operation',operation,'protocol',protocol)::text, CASE WHEN "durationMs" <= 10000 THEN 1 ELSE 0 END FROM new_rows) AS increments
  GROUP BY kind, labels ORDER BY kind, labels
  ON CONFLICT (kind, labels) DO UPDATE SET value = target.value + EXCLUDED.value;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.count_prometheus_features() FROM PUBLIC;
CREATE TRIGGER count_prometheus_features AFTER INSERT ON public."FeatureOperationEvent"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.count_prometheus_features();

CREATE FUNCTION public.count_prometheus_runtime() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
BEGIN
  INSERT INTO public."PrometheusCounter" AS target (kind, labels, value)
  SELECT kind, labels, sum(value) FROM (SELECT 'runtime' AS kind, jsonb_build_object('level', issue.level, 'event', CASE
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
      END, 'status', CASE WHEN issue.status IS NULL THEN 'none' ELSE (issue.status / 100)::text || 'xx' END)::text AS labels, 1::numeric AS value FROM new_rows issue) AS increments
  GROUP BY kind, labels ORDER BY kind, labels
  ON CONFLICT (kind, labels) DO UPDATE SET value = target.value + EXCLUDED.value;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.count_prometheus_runtime() FROM PUBLIC;
CREATE TRIGGER count_prometheus_runtime AFTER INSERT ON public."RuntimeIssueEvent"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.count_prometheus_runtime();

CREATE FUNCTION public.count_prometheus_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
BEGIN
  INSERT INTO public."PrometheusCounter" AS target (kind, labels, value)
  SELECT kind, labels, sum(value) FROM (SELECT 'audit' AS kind, jsonb_build_object('action',action,'channel',channel,'outcome',outcome)::text AS labels, 1::numeric AS value FROM new_rows WHERE "oauthClientId" IS NULL OR channel::text NOT IN ('rest','graphql','mcp')) AS increments
  GROUP BY kind, labels ORDER BY kind, labels
  ON CONFLICT (kind, labels) DO UPDATE SET value = target.value + EXCLUDED.value;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.count_prometheus_audit() FROM PUBLIC;
CREATE TRIGGER count_prometheus_audit AFTER INSERT ON public."AuditLog"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.count_prometheus_audit();

CREATE FUNCTION public.count_prometheus_oauth_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
BEGIN
  INSERT INTO public."PrometheusCounter" AS target (kind, labels, value)
  SELECT kind, labels, sum(value) FROM (SELECT 'oauth_read' AS kind, jsonb_build_object('channel', usage.channel, 'feature', CASE usage.feature
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
        END)::text AS labels, usage."readCount"::numeric AS value FROM new_rows usage
    UNION ALL
    SELECT 'oauth_write' AS kind, jsonb_build_object('channel', usage.channel, 'feature', CASE usage.feature
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
        END)::text AS labels, usage."writeCount"::numeric AS value FROM new_rows usage
    UNION ALL
    SELECT 'oauth_error' AS kind, jsonb_build_object('channel', usage.channel, 'feature', CASE usage.feature
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
        END)::text AS labels, usage."errorCount"::numeric AS value FROM new_rows usage) AS increments
  GROUP BY kind, labels ORDER BY kind, labels
  ON CONFLICT (kind, labels) DO UPDATE SET value = target.value + EXCLUDED.value;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.count_prometheus_oauth_insert() FROM PUBLIC;
CREATE TRIGGER count_prometheus_oauth_insert AFTER INSERT ON public."OAuthGrantUsageDaily"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.count_prometheus_oauth_insert();

CREATE FUNCTION public.count_prometheus_oauth_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
BEGIN
  INSERT INTO public."PrometheusCounter" AS target (kind, labels, value)
  SELECT kind, labels, sum(value) FROM (SELECT 'oauth_read' AS kind, jsonb_build_object('channel', usage.channel, 'feature', CASE usage.feature
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
        END)::text AS labels, greatest(usage."readCount" - previous."readCount", 0)::numeric AS value FROM new_rows usage JOIN old_rows previous ON previous.id = usage.id
    UNION ALL
    SELECT 'oauth_write' AS kind, jsonb_build_object('channel', usage.channel, 'feature', CASE usage.feature
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
        END)::text AS labels, greatest(usage."writeCount" - previous."writeCount", 0)::numeric AS value FROM new_rows usage JOIN old_rows previous ON previous.id = usage.id
    UNION ALL
    SELECT 'oauth_error' AS kind, jsonb_build_object('channel', usage.channel, 'feature', CASE usage.feature
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
        END)::text AS labels, greatest(usage."errorCount" - previous."errorCount", 0)::numeric AS value FROM new_rows usage JOIN old_rows previous ON previous.id = usage.id) AS increments
  GROUP BY kind, labels ORDER BY kind, labels
  ON CONFLICT (kind, labels) DO UPDATE SET value = target.value + EXCLUDED.value;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.count_prometheus_oauth_update() FROM PUBLIC;
CREATE TRIGGER count_prometheus_oauth_update AFTER UPDATE ON public."OAuthGrantUsageDaily"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.count_prometheus_oauth_update();

CREATE FUNCTION public.count_prometheus_registrations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
BEGIN
  INSERT INTO public."PrometheusCounter" AS target (kind, labels, value)
  SELECT kind, labels, sum(value) FROM (SELECT 'registrations' AS kind, '{}'::text AS labels, count(*)::numeric AS value FROM new_rows) AS increments
  GROUP BY kind, labels ORDER BY kind, labels
  ON CONFLICT (kind, labels) DO UPDATE SET value = target.value + EXCLUDED.value;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.count_prometheus_registrations() FROM PUBLIC;
CREATE TRIGGER count_prometheus_registrations AFTER INSERT ON public."User"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.count_prometheus_registrations();

CREATE FUNCTION public.count_prometheus_deletions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
BEGIN
  INSERT INTO public."PrometheusCounter" AS target (kind, labels, value)
  SELECT kind, labels, sum(value) FROM (SELECT 'deletions' AS kind, '{}'::text AS labels, count(*)::numeric AS value FROM new_rows) AS increments
  GROUP BY kind, labels ORDER BY kind, labels
  ON CONFLICT (kind, labels) DO UPDATE SET value = target.value + EXCLUDED.value;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.count_prometheus_deletions() FROM PUBLIC;
CREATE TRIGGER count_prometheus_deletions AFTER DELETE ON public."User"
REFERENCING OLD TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.count_prometheus_deletions();

CREATE OR REPLACE FUNCTION public.read_prometheus_metrics_snapshot()
RETURNS TABLE ("generatedAt" timestamp(3) without time zone, payload jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_now timestamp(3) := (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3);
  v_at timestamp(3);
  v_cache jsonb;
  v_first timestamp(3);
  v_users jsonb;
  v_activity jsonb;
  v_oauth jsonb;
  v_refresh boolean := false;
BEGIN
  SELECT cache."generatedAt", cache.payload INTO v_at,v_cache
  FROM public."PrometheusMetricsCache" cache WHERE id=1;
  IF v_at IS NULL OR v_at < v_now - interval '60 seconds' THEN
    IF pg_try_advisory_xact_lock(hashtextextended('life-ustc.prometheus-metrics-cache',0)) THEN
      v_refresh := true;
    ELSIF v_at IS NULL OR v_at < v_now - interval '120 seconds' THEN
      RAISE EXCEPTION 'prometheus activity refresh is busy' USING ERRCODE='55P03';
    END IF;
  END IF;
  IF v_refresh THEN
    SELECT min("occurredAt") INTO v_first FROM public."FeatureOperationEvent" WHERE "occurredAt" <= v_now;
    WITH windows(name,start_at) AS (VALUES ('24h',v_now-interval '24 hours'),('7d',v_now-interval '7 days'),('30d',v_now-interval '30 days'))
    SELECT jsonb_agg(jsonb_build_object('window',name,'active_users',CASE WHEN v_first IS NULL THEN NULL ELSE (SELECT count(DISTINCT "userId") FROM public."FeatureOperationEvent" WHERE "occurredAt">=start_at AND "occurredAt"<=v_now) END) ORDER BY name)
    INTO v_users FROM windows;
    WITH windows(name,start_at) AS (VALUES ('24h',v_now-interval '24 hours'),('7d',v_now-interval '7 days'),('30d',v_now-interval '30 days')),
    tuples AS (SELECT DISTINCT feature,protocol FROM public."FeatureOperationEvent" WHERE "occurredAt">=v_now-interval '30 days' AND "occurredAt"<=v_now),
    activity AS (SELECT w.name AS window,t.feature,t.protocol,count(DISTINCT f."userId") AS users FROM windows w CROSS JOIN tuples t LEFT JOIN public."FeatureOperationEvent" f ON f.feature=t.feature AND f.protocol=t.protocol AND f."occurredAt">=w.start_at AND f."occurredAt"<=v_now GROUP BY w.name,t.feature,t.protocol)
    SELECT coalesce(jsonb_agg(to_jsonb(activity) ORDER BY activity.window,feature,protocol),'[]') INTO v_activity FROM activity;
    WITH windows(name,start_at) AS (VALUES ('24h',v_now-interval '24 hours'),('7d',v_now-interval '7 days'),('30d',v_now-interval '30 days'))
    SELECT jsonb_agg(jsonb_build_object('window',name,'active_clients',(SELECT count(DISTINCT "clientId") FROM public."OAuthGrantUsageDaily" WHERE "lastUsedAt">=start_at AND "lastUsedAt"<=v_now)) ORDER BY name) INTO v_oauth FROM windows;
    v_at := v_now;
    v_cache := jsonb_build_object(
      'first_feature_recorded_at',CASE WHEN v_first IS NULL THEN NULL ELSE to_char(v_first,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'summary',jsonb_build_object('users',(SELECT count(*) FROM public."User"),'comments',(SELECT count(*) FROM public."Comment"),'homeworks',(SELECT count(*) FROM public."Homework"),'oauth_clients',(SELECT count(*) FROM public."OAuthClient"),'active_suspensions',(SELECT count(*) FROM public."UserSuspension" WHERE "liftedAt" IS NULL)),
      'users',v_users,'feature_activity',v_activity,'oauth_summary',v_oauth);
    INSERT INTO public."PrometheusMetricsCache" AS cache (id,"generatedAt",payload,"updatedAt") VALUES(1,v_at,v_cache,v_now)
    ON CONFLICT(id) DO UPDATE SET "generatedAt"=EXCLUDED."generatedAt",payload=EXCLUDED.payload,"updatedAt"=EXCLUDED."updatedAt";
  END IF;
  -- Only the expensive gauges are cached. Counter snapshots are always fresh.
  RETURN QUERY SELECT v_now,v_cache || jsonb_build_object(
    'schema_version',2,
    'activity_generated_at',to_char(v_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'counter_started_at',(SELECT to_char("startedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM public."PrometheusCounterEpoch" WHERE id=1),
    'counters',(SELECT coalesce(jsonb_agg(jsonb_build_object('kind',kind,'labels',labels::jsonb,'value',value) ORDER BY kind,labels),'[]') FROM public."PrometheusCounter"));
END $fn$;
REVOKE ALL ON FUNCTION public.read_prometheus_metrics_snapshot() FROM PUBLIC;
DO $roles$
DECLARE t text; f text;
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='life_ustc_function_owner') THEN
  FOREACH t IN ARRAY ARRAY['PrometheusCounter','PrometheusCounterEpoch'] LOOP
   EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO life_ustc_function_owner',t);
   EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO life_ustc_function_owner USING(true) WITH CHECK(true)',t || '_function_owner',t);
  END LOOP;
  ALTER FUNCTION public.count_prometheus_features() OWNER TO life_ustc_function_owner;
  ALTER FUNCTION public.count_prometheus_runtime() OWNER TO life_ustc_function_owner;
  ALTER FUNCTION public.count_prometheus_audit() OWNER TO life_ustc_function_owner;
  ALTER FUNCTION public.count_prometheus_oauth_insert() OWNER TO life_ustc_function_owner;
  ALTER FUNCTION public.count_prometheus_oauth_update() OWNER TO life_ustc_function_owner;
  ALTER FUNCTION public.count_prometheus_registrations() OWNER TO life_ustc_function_owner;
  ALTER FUNCTION public.count_prometheus_deletions() OWNER TO life_ustc_function_owner;
 END IF;
END $roles$;

COMMIT;
