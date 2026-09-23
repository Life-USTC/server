-- Fail closed when application reads audit or OAuth usage data without an
-- explicit user context. Public homework history remains readable because it
-- is itself public collaborative content.
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OAuthGrantUsageDaily" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AuditLog_append_only" ON public."AuditLog";
CREATE POLICY "AuditLog_append_only" ON public."AuditLog"
  FOR INSERT TO PUBLIC
  WITH CHECK (true);

DROP POLICY IF EXISTS "AuditLog_scoped_reader" ON public."AuditLog";
CREATE POLICY "AuditLog_scoped_reader" ON public."AuditLog"
  FOR SELECT TO PUBLIC
  USING (
    "subjectUserId" = NULLIF(current_setting('app.user_id', true), '')
    OR (
      "targetType" = 'homework'
      AND "action" IN ('homework_create', 'homework_update', 'homework_delete')
    )
    OR EXISTS (
      SELECT 1
      FROM public."User" AS app_user
      WHERE app_user."id" = NULLIF(current_setting('app.user_id', true), '')
        AND app_user."isAdmin" = true
    )
  );

DROP POLICY IF EXISTS "OAuthGrantUsageDaily_scoped_reader"
  ON public."OAuthGrantUsageDaily";
CREATE POLICY "OAuthGrantUsageDaily_scoped_reader"
  ON public."OAuthGrantUsageDaily"
  FOR SELECT TO PUBLIC
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
    OR EXISTS (
      SELECT 1
      FROM public."User" AS app_user
      WHERE app_user."id" = NULLIF(current_setting('app.user_id', true), '')
        AND app_user."isAdmin" = true
    )
  );

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime') THEN
    EXECUTE 'DROP POLICY IF EXISTS "OAuthGrantUsageDaily_auth_runtime" ON public."OAuthGrantUsageDaily"';
    EXECUTE 'CREATE POLICY "OAuthGrantUsageDaily_auth_runtime" ON public."OAuthGrantUsageDaily" FOR ALL TO life_ustc_auth_runtime USING (true) WITH CHECK (true)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    EXECUTE 'DROP POLICY IF EXISTS "AuditLog_function_owner" ON public."AuditLog"';
    EXECUTE 'CREATE POLICY "AuditLog_function_owner" ON public."AuditLog" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "OAuthGrantUsageDaily_function_owner" ON public."OAuthGrantUsageDaily"';
    EXECUTE 'CREATE POLICY "OAuthGrantUsageDaily_function_owner" ON public."OAuthGrantUsageDaily" FOR ALL TO life_ustc_function_owner USING (true) WITH CHECK (true)';
  END IF;
END
$roles$;

-- OAuth usage only backs the 7/30/90-day product windows. Keep 90 Shanghai
-- calendar days and delete in bounded, retry-safe batches.
CREATE INDEX "OAuthGrantUsageDaily_day_id_idx"
  ON public."OAuthGrantUsageDaily"("day", "id");

CREATE FUNCTION public.maintain_oauth_grant_usage_retention(
  p_now timestamp(3) without time zone,
  p_batch_size integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_rows_deleted bigint;
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
    FROM public."OAuthGrantUsageDaily" AS source
    WHERE source."day" < (
      (p_now + interval '8 hours')::date - interval '89 days'
    )
    ORDER BY source."day", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."OAuthGrantUsageDaily" AS target
  USING candidates
  WHERE target."id" = candidates."id";
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  RETURN v_rows_deleted;
END;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.maintain_oauth_grant_usage_retention(timestamp without time zone, integer)
  FROM PUBLIC;

-- Gate, anonymization, and user deletion now happen in one database statement.
-- The advisory lock prevents two administrators from concurrently deleting
-- each other and leaving the installation without an administrator.
CREATE FUNCTION public.delete_own_account(
  p_user_id text,
  p_audit_id text,
  p_channel public."AuditChannel",
  p_ip_address text,
  p_user_agent text,
  p_session_id text,
  p_request_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_is_admin boolean;
  v_session_user_id text;
BEGIN
  IF p_user_id IS NULL OR pg_catalog.btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'user id must not be empty' USING ERRCODE = '22023';
  END IF;
  IF p_audit_id IS NULL OR pg_catalog.btrim(p_audit_id) = '' THEN
    RAISE EXCEPTION 'audit id must not be empty' USING ERRCODE = '22023';
  END IF;

  -- The definer function is callable by the shared auth runtime, so never
  -- trust p_user_id by itself. Bind deletion to a live, recently-created
  -- server-side session owned by that same user.
  SELECT auth_session."userId"
  INTO v_session_user_id
  FROM public."Session" AS auth_session
  WHERE auth_session."id" = p_session_id
    AND auth_session."expires" > (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC')
    AND auth_session."createdAt" > (
      (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC') - interval '15 minutes'
    );
  IF v_session_user_id IS NULL OR v_session_user_id <> p_user_id THEN
    INSERT INTO public."AuditLog" (
      "id", "action", "outcome", "channel", "userId", "subjectUserId",
      "targetId", "targetType", "metadata", "ipAddress", "userAgent",
      "sessionId", "requestId"
    ) VALUES (
      p_audit_id, 'account_delete', 'denied', p_channel,
      v_session_user_id, v_session_user_id, p_user_id, 'user',
      '{"reason":"session_user_mismatch","selfService":true}'::jsonb,
      p_ip_address, p_user_agent, p_session_id, p_request_id
    );
    RETURN 'unauthorized';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('life-ustc.delete-own-account', 0)
  );
  SELECT app_user."isAdmin"
  INTO v_is_admin
  FROM public."User" AS app_user
  WHERE app_user."id" = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_is_admin AND (
    SELECT pg_catalog.count(*)
    FROM public."User" AS app_user
    WHERE app_user."isAdmin" = true
  ) <= 1 THEN
    INSERT INTO public."AuditLog" (
      "id", "action", "outcome", "channel", "userId", "subjectUserId",
      "targetId", "targetType", "metadata", "ipAddress", "userAgent",
      "sessionId", "requestId"
    ) VALUES (
      p_audit_id, 'account_delete', 'denied', p_channel, p_user_id, p_user_id,
      p_user_id, 'user', '{"reason":"cannot_remove_last_admin","selfService":true}'::jsonb,
      p_ip_address, p_user_agent, p_session_id, p_request_id
    );
    RETURN 'cannot_remove_last_admin';
  END IF;

  UPDATE public."AuditLog"
  SET "targetId" = NULL
  WHERE "targetId" = p_user_id
    AND "targetType" IN ('user', 'calendar_feed');
  INSERT INTO public."AuditLog" (
    "id", "action", "outcome", "channel", "userId", "subjectUserId",
    "targetType", "metadata", "ipAddress", "userAgent", "sessionId",
    "requestId"
  ) VALUES (
    p_audit_id, 'account_delete', 'success', p_channel, p_user_id, p_user_id,
    'user', '{"selfService":true}'::jsonb, p_ip_address, p_user_agent,
    p_session_id, p_request_id
  );
  DELETE FROM public."User" WHERE "id" = p_user_id;
  RETURN 'deleted';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_own_account(
  text, text, public."AuditChannel", text, text, text, text
) FROM PUBLIC;

-- Account deletion owns the whole transaction now; the independently
-- executable helper would only preserve an obsolete, weaker mutation path.
DROP FUNCTION public.anonymize_deleted_account_audit_targets(text);

DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    EXECUTE 'GRANT SELECT, DELETE ON TABLE public."User" TO life_ustc_function_owner';
    EXECUTE 'GRANT SELECT ON TABLE public."Session" TO life_ustc_function_owner';
    EXECUTE 'GRANT UPDATE ("id") ON TABLE public."User" TO life_ustc_function_owner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."AuditLog" TO life_ustc_function_owner';
    EXECUTE 'GRANT SELECT, UPDATE, DELETE ON TABLE public."OAuthGrantUsageDaily" TO life_ustc_function_owner';
    EXECUTE 'ALTER FUNCTION public.maintain_oauth_grant_usage_retention(timestamp without time zone, integer) OWNER TO life_ustc_function_owner';
    EXECUTE 'ALTER FUNCTION public.delete_own_account(text, text, public."AuditChannel", text, text, text, text) OWNER TO life_ustc_function_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime') THEN
    EXECUTE 'REVOKE DELETE ON TABLE public."User" FROM life_ustc_auth_runtime';
    EXECUTE 'REVOKE INSERT ON TABLE public."AuditLog" FROM life_ustc_auth_runtime';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_own_account(text, text, public."AuditChannel", text, text, text, text) TO life_ustc_auth_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_maintenance_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.maintain_oauth_grant_usage_retention(timestamp without time zone, integer) TO life_ustc_maintenance_runtime';
  END IF;
END
$grants$;
