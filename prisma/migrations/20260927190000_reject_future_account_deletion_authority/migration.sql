-- Keep the database deletion gate aligned with authoritative session checks.
CREATE OR REPLACE FUNCTION public.delete_own_account(
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
    AND auth_session."createdAt" <= (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC')
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
