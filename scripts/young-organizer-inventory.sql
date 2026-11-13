-- Inventory draft: locally validated on PostgreSQL 16.14 in READ ONLY / REPEATABLE READ, ending in ROLLBACK.
-- No production execution or migration readiness is claimed. No connection details belong here.
-- Review the target database fingerprint out of band before accepting results.
-- Intended runner: psql --no-psqlrc --set=ON_ERROR_STOP=on --file <this file>
-- On any error, stop and disconnect (aborts this transaction); do not retry with RLS enabled.
-- Read-only, one consistent snapshot, aggregate-only output; no DDL/temp tables/functions.
-- No organizer-name splitting, source-ID/name zipping, or inferred atomic identity.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL row_security = off;
SET LOCAL search_path = pg_catalog;

-- 1. Target/schema fingerprints, actual key types, and role/RLS completeness context.
-- row_security=off DOES NOT bypass RLS: a query subject to a policy must error.
WITH wanted(name) AS (VALUES
  ('YoungEvent'), ('YoungOrganizer'), ('UserYoungOrganizerSubscription'),
  ('UserYoungEventSubscription'), ('YoungNotification')
), relations AS (
  SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity,
         c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owned_by_current_role
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN wanted w ON w.name = c.relname WHERE n.nspname = 'public' AND c.relkind = 'r'
), column_shapes AS (
  SELECT r.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS type,
         a.attnotnull, a.attidentity,
         coalesce(pg_get_expr(d.adbin, d.adrelid), '') AS default_expression
  FROM relations r JOIN pg_attribute a ON a.attrelid = r.oid
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
), fingerprints AS (
  SELECT
    (SELECT md5(string_agg(concat_ws('|',relname,attname,type,attnotnull,attidentity,default_expression), E'\n'
      ORDER BY relname COLLATE "C", attname COLLATE "C")) FROM column_shapes) AS columns,
    (SELECT md5(string_agg(r.relname || '|' || c.contype::text || '|' || pg_get_constraintdef(c.oid), E'\n'
      ORDER BY r.relname COLLATE "C", c.conname COLLATE "C"))
      FROM relations r JOIN pg_constraint c ON c.conrelid = r.oid) AS constraints,
    (SELECT md5(string_agg(r.relname || '|' || i.indisvalid::text || '|' || i.indisready::text || '|' || pg_get_indexdef(i.indexrelid), E'\n'
      ORDER BY r.relname COLLATE "C", pg_get_indexdef(i.indexrelid) COLLATE "C"))
      FROM relations r JOIN pg_index i ON i.indrelid = r.oid) AS indexes,
    (SELECT md5(coalesce(string_agg(r.relname || '|' || p.polname || '|' || p.polcmd::text || '|' || p.polroles::text || '|' || p.polpermissive::text || '|' ||
      coalesce(pg_get_expr(p.polqual,p.polrelid),'') || '|' ||
      coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''), E'\n'
      ORDER BY r.relname COLLATE "C", p.polname COLLATE "C"), 'none'))
      FROM relations r JOIN pg_policy p ON p.polrelid = r.oid) AS policies
)
SELECT 'schema_context' AS report,
  md5(current_database()) AS database_name_fingerprint,
  md5(concat_ws('|', current_database(),
    coalesce(inet_server_addr()::text, '<unix-socket>'),
    coalesce(inet_server_port()::text, '<unix-socket>'))) AS endpoint_fingerprint,
  transaction_timestamp() AS inventory_transaction_at,
  current_setting('server_version_num') AS server_version_num,
  current_setting('server_encoding') AS server_encoding,
  current_setting('transaction_read_only') AS transaction_read_only,
  current_setting('transaction_isolation') AS transaction_isolation,
  current_setting('row_security') AS row_security,
  (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS role_is_superuser,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS role_bypasses_rls,
  (SELECT count(*) FROM relations) AS actual_relations_expected_five,
  (SELECT jsonb_agg(jsonb_build_object('table',relname,'rls',relrowsecurity,
    'force_rls',relforcerowsecurity,'owned_by_current_role',owned_by_current_role)
    ORDER BY relname) FROM relations) AS relation_flags,
  (SELECT jsonb_agg(jsonb_build_object('table',relname,'column',attname,'type',type,'not_null',attnotnull)
    ORDER BY relname,attname) FROM column_shapes
    WHERE (relname = 'YoungEvent' AND attname IN ('id','youngId','organizerId','rawJson','upstreamOrganizerIds','upstreamSponsorIds'))
       OR (relname = 'YoungOrganizer' AND attname IN ('id','normalizedName'))
       OR (relname IN ('UserYoungOrganizerSubscription','UserYoungEventSubscription','YoungNotification')
           AND attname IN ('id','userId','youngId','organizerId'))) AS key_shapes,
  fingerprints.* FROM fingerprints;

-- 2. Aggregate cardinalities only. Permission/RLS errors invalidate completeness.
SELECT 'row_totals' AS report,
  (SELECT count(*) FROM public."YoungEvent") AS events,
  (SELECT count(*) FROM public."YoungOrganizer") AS organizer_entities,
  (SELECT count(*) FROM public."UserYoungOrganizerSubscription") AS organizer_follows,
  (SELECT count(DISTINCT "userId") FROM public."UserYoungOrganizerSubscription") AS organizer_follow_users,
  (SELECT count(*) FROM public."UserYoungEventSubscription") AS direct_event_subscriptions,
  (SELECT count(*) FROM public."YoungNotification") AS notifications;

-- 3. Stored arrays: exact IDs only, never names; do not re-split strings or normalize identities.
-- The importer already discards duplicate/blank CSV tokens; zero anomalies here do not prove upstream lacked them.
WITH arrays AS (
  SELECT 'organizer'::text AS field, "upstreamOrganizerIds" AS ids FROM public."YoungEvent"
  UNION ALL SELECT 'sponsor', "upstreamSponsorIds" FROM public."YoungEvent"
), measured AS (
  SELECT field, cardinality(ids) AS slots,
    (SELECT count(*) FROM unnest(ids) AS u(v) WHERE v IS NULL) AS null_slots,
    (SELECT count(*) FROM unnest(ids) AS u(v) WHERE v = '') AS empty_slots,
    (SELECT count(*) FROM unnest(ids) AS u(v) WHERE v <> '' AND btrim(v) = '') AS ascii_space_slots,
    (SELECT count(v) - count(DISTINCT v) FROM unnest(ids) AS u(v)) AS duplicate_nonnull_slots
  FROM arrays
)
SELECT 'saved_arrays' AS report, field,
  CASE WHEN slots IS NULL THEN 'null_array' WHEN slots = 0 THEN 'zero' WHEN slots = 1 THEN 'one' ELSE 'multiple' END AS cardinality,
  count(*) AS event_rows, sum(null_slots) AS null_slots, sum(empty_slots) AS empty_slots,
  sum(ascii_space_slots) AS ascii_space_slots, sum(duplicate_nonnull_slots) AS duplicate_nonnull_slots,
  count(*) FILTER (WHERE duplicate_nonnull_slots > 0) AS events_with_duplicates
FROM measured GROUP BY field, cardinality ORDER BY field, cardinality;

-- 4. Raw provenance shape, including scalar/non-object rawJson and absent versus explicit JSON null.
-- rawJson is upstreamColumns(row), excluding snapshot bookkeeping, before organizer/sponsor fallback.
WITH shapes AS (
  SELECT jsonb_typeof(e."rawJson") AS raw_type, k.key,
    CASE WHEN jsonb_typeof(e."rawJson") IS DISTINCT FROM 'object' THEN 'raw_not_object'
         WHEN NOT (e."rawJson" ? k.key) THEN 'absent'
         ELSE jsonb_typeof(e."rawJson" -> k.key) END AS value_type,
    e."rawJson" -> k.key AS value
  FROM public."YoungEvent" e CROSS JOIN
    (VALUES ('organizer'),('organizer_dictText'),('sponsor'),('sponsor_dictText')) AS k(key)
)
SELECT 'raw_shapes' AS report, raw_type, key, value_type, count(*) AS event_rows,
  count(*) FILTER (WHERE value_type = 'string' AND value #>> '{}' = '') AS empty_strings,
  count(*) FILTER (WHERE value_type = 'string' AND value #>> '{}' <> '' AND btrim(value #>> '{}') = '') AS ascii_space_strings,
  count(*) FILTER (WHERE value_type = 'array' AND jsonb_array_length(CASE WHEN value_type = 'array' THEN value ELSE '[]'::jsonb END) = 0) AS empty_arrays
FROM shapes GROUP BY raw_type,key,value_type ORDER BY raw_type,key,value_type;

-- 5. Array element kinds and exact duplicate/blank STRING elements if a raw field actually is an array.
-- No implicit JavaScript String(array) reconstruction and no positional ID/name pairing.
WITH raw_arrays AS (
  SELECT e.id, k.key, e."rawJson" -> k.key AS value
  FROM public."YoungEvent" e CROSS JOIN
    (VALUES ('organizer'),('organizer_dictText'),('sponsor'),('sponsor_dictText')) AS k(key)
  WHERE jsonb_typeof(e."rawJson") = 'object' AND jsonb_typeof(e."rawJson" -> k.key) = 'array'
), elements AS (
  SELECT a.id,a.key,v.value,jsonb_typeof(v.value) AS element_type
  FROM raw_arrays a CROSS JOIN LATERAL jsonb_array_elements(a.value) AS v(value)
), groups AS (
  SELECT id,key,element_type,count(*) AS slots,count(DISTINCT value) AS distinct_values,
    count(*) FILTER (WHERE element_type = 'string' AND btrim(value #>> '{}') = '') AS blank_strings
  FROM elements GROUP BY id,key,element_type
)
SELECT 'raw_array_elements' AS report,key,element_type,count(*) AS event_rows,
  sum(slots) AS slots,sum(slots-distinct_values) AS exact_duplicate_slots,sum(blank_strings) AS blank_string_slots
FROM groups GROUP BY key,element_type ORDER BY key,element_type;

-- 6. Local-to-source ambiguity. Multi-source edges are observations, NOT atomic identity assignments.
-- "single_saved_source" is only a candidate: authoritative dictionary/provenance verification is still needed.
WITH event_sources AS (
  SELECT e.id,e."organizerId",array(SELECT DISTINCT v FROM unnest(e."upstreamOrganizerIds") AS u(v)
    WHERE v IS NOT NULL AND btrim(v) <> '') AS source_ids
  FROM public."YoungEvent" e
), observed AS (
  SELECT 'all_saved_sources'::text AS evidence,e."organizerId" AS local_id,u.source_id
  FROM event_sources e CROSS JOIN LATERAL unnest(e.source_ids) AS u(source_id)
  UNION ALL
  SELECT 'single_saved_source',e."organizerId",e.source_ids[1]
  FROM event_sources e WHERE cardinality(e.source_ids) = 1
), per_local AS (
  SELECT k.evidence,o.id AS local_id,count(DISTINCT v.source_id) AS linked
  FROM public."YoungOrganizer" o
  CROSS JOIN (VALUES ('all_saved_sources'),('single_saved_source')) AS k(evidence)
  LEFT JOIN observed v ON v.local_id = o.id AND v.evidence = k.evidence
  GROUP BY k.evidence,o.id
), per_source AS (
  SELECT evidence,source_id,count(DISTINCT local_id) AS linked FROM observed GROUP BY evidence,source_id
), summary AS (
  SELECT 'local_to_source' AS direction,evidence,linked FROM per_local
  UNION ALL SELECT 'source_to_local',evidence,linked FROM per_source
)
SELECT 'identity_ambiguity' AS report,direction,evidence,
  CASE WHEN linked = 0 THEN 'zero' WHEN linked = 1 THEN 'one' ELSE 'multiple' END AS counterpart_count,count(*) AS identities
FROM summary GROUP BY direction,evidence,counterpart_count ORDER BY direction,evidence,counterpart_count;

-- 7. Provenance eligibility counts only; labels remain opaque and no NFKC/CSV pairing is invented.
WITH evidence AS (
  SELECT e."organizerId", cardinality(e."upstreamOrganizerIds") AS saved_slots,
    jsonb_typeof(e."rawJson" -> 'organizer_dictText') AS organizer_label_type,
    CASE WHEN jsonb_typeof(e."rawJson" -> 'organizer_dictText') = 'string'
      THEN btrim(e."rawJson" ->> 'organizer_dictText') <> '' ELSE false END AS organizer_label_nonempty,
    CASE WHEN jsonb_typeof(e."rawJson" -> 'sponsor_dictText') = 'string'
      THEN btrim(e."rawJson" ->> 'sponsor_dictText') <> '' ELSE false END AS sponsor_label_nonempty
  FROM public."YoungEvent" e
)
SELECT 'provenance_candidates_not_verified' AS report,
  CASE WHEN organizer_label_nonempty THEN 'organizer_string_present'
       WHEN organizer_label_type IS NOT NULL AND organizer_label_type NOT IN ('string','null') THEN 'nonstring_organizer_unresolved'
       WHEN sponsor_label_nonempty THEN 'sponsor_only_string_candidate'
       ELSE 'no_nonempty_string_label' END AS label_evidence,
  CASE WHEN saved_slots IS NULL THEN 'null_array' WHEN saved_slots = 0 THEN 'zero' WHEN saved_slots = 1 THEN 'one' ELSE 'multiple' END AS saved_cardinality,
  ("organizerId" IS NOT NULL) AS linked_local_entity,count(*) AS event_rows
FROM evidence GROUP BY label_evidence,saved_cardinality,linked_local_entity
ORDER BY label_evidence,saved_cardinality,linked_local_entity;

-- 8. Follow exposure of legacy multi-source CANDIDATES, without expanding any follow.
-- Candidate means a local scalar organizer linked from an event with >1 distinct saved nonblank source ID.
WITH candidates AS (
  SELECT DISTINCT e."organizerId" AS id FROM public."YoungEvent" e
  WHERE e."organizerId" IS NOT NULL AND
    (SELECT count(DISTINCT v) FROM unnest(e."upstreamOrganizerIds") AS u(v)
     WHERE v IS NOT NULL AND btrim(v) <> '') > 1
)
SELECT 'legacy_multi_source_candidate_exposure' AS report,
  (SELECT count(*) FROM candidates) AS candidate_entities,
  (SELECT count(*) FROM public."YoungEvent" e JOIN candidates c ON c.id = e."organizerId") AS linked_events,
  (SELECT count(*) FROM public."UserYoungOrganizerSubscription" s JOIN candidates c ON c.id = s."organizerId") AS organizer_follow_rows,
  (SELECT count(DISTINCT s."userId") FROM public."UserYoungOrganizerSubscription" s JOIN candidates c ON c.id = s."organizerId") AS distinct_follow_users,
  (SELECT count(*) FROM public."UserYoungEventSubscription" s JOIN public."YoungEvent" e ON e."youngId" = s."youngId"
    JOIN candidates c ON c.id = e."organizerId") AS separate_direct_event_subscription_rows;

-- 9. Notifications: finite kind/read/expiry/association buckets, no IDs/title/body/dedupeKey output.
-- Notifications have nullable scalar IDs but no Prisma organizer/event FK relation; inventory dangling references explicitly.
WITH candidates AS (
  SELECT DISTINCT e."organizerId" AS id FROM public."YoungEvent" e
  WHERE e."organizerId" IS NOT NULL AND
    (SELECT count(DISTINCT v) FROM unnest(e."upstreamOrganizerIds") AS u(v)
     WHERE v IS NOT NULL AND btrim(v) <> '') > 1
), classified AS (
  SELECT CASE WHEN n.kind IN ('event_changed','signup_open','signup_deadline','event_start','organizer_digest')
         THEN n.kind ELSE 'other_unrecognized_kind' END AS kind,
    (n."readAt" IS NOT NULL) AS is_read,
    CASE WHEN n."expiresAt" IS NULL THEN 'no_expiry'
         WHEN n."expiresAt" <= transaction_timestamp() THEN 'expired' ELSE 'future' END AS expiry,
    CASE WHEN n."organizerId" IS NULL THEN 'no_organizer'
         WHEN NOT EXISTS (SELECT 1 FROM public."YoungOrganizer" o WHERE o.id = n."organizerId") THEN 'dangling_organizer'
         WHEN EXISTS (SELECT 1 FROM candidates c WHERE c.id = n."organizerId") THEN 'legacy_multi_source_candidate'
         ELSE 'other_existing_organizer' END AS organizer_association,
    CASE WHEN n."youngId" IS NULL THEN 'no_event'
         WHEN EXISTS (SELECT 1 FROM public."YoungEvent" e WHERE e."youngId" = n."youngId") THEN 'existing_event'
         ELSE 'dangling_event' END AS event_association
  FROM public."YoungNotification" n
)
SELECT 'notification_aggregates' AS report,kind,is_read,expiry,organizer_association,event_association,count(*) AS notifications
FROM classified GROUP BY kind,is_read,expiry,organizer_association,event_association
ORDER BY kind,is_read,expiry,organizer_association,event_association;

ROLLBACK;
