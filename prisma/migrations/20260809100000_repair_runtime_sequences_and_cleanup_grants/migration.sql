-- Keep reused databases safe after a snapshot seed and make cleanup grants
-- converge even when the production role bootstrap was not rerun.
DO $$
DECLARE
  item record;
  table_max bigint;
  sequence_last bigint;
  sequence_called boolean;
BEGIN
  FOR item IN
    SELECT
      seq_ns.nspname AS sequence_schema,
      seq.relname AS sequence_name,
      tbl_ns.nspname AS table_schema,
      tbl.relname AS table_name,
      attr.attname AS column_name
    FROM pg_class AS seq
    JOIN pg_namespace AS seq_ns ON seq_ns.oid = seq.relnamespace
    JOIN pg_depend AS dep ON dep.objid = seq.oid AND dep.deptype IN ('a', 'i')
    JOIN pg_class AS tbl ON tbl.oid = dep.refobjid
    JOIN pg_namespace AS tbl_ns ON tbl_ns.oid = tbl.relnamespace
    JOIN pg_attribute AS attr ON attr.attrelid = tbl.oid AND attr.attnum = dep.refobjsubid
    WHERE seq.relkind = 'S' AND tbl_ns.nspname = 'public'
  LOOP
    EXECUTE format('SELECT max(%I)::bigint FROM %I.%I', item.column_name, item.table_schema, item.table_name)
      INTO table_max;
    EXECUTE format('SELECT last_value::bigint, is_called FROM %I.%I', item.sequence_schema, item.sequence_name)
      INTO sequence_last, sequence_called;
    IF table_max IS NOT NULL
      AND (sequence_last < table_max OR (NOT sequence_called AND sequence_last = table_max))
    THEN
      PERFORM setval(
        format('%I.%I', item.sequence_schema, item.sequence_name)::regclass,
        table_max,
        true
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    EXECUTE 'ALTER FUNCTION public.claim_upload_pending_storage_cleanup(timestamp without time zone, integer, integer) OWNER TO life_ustc_function_owner';
    EXECUTE 'ALTER FUNCTION public.finalize_upload_pending_storage_cleanup(text, text) OWNER TO life_ustc_function_owner';
    EXECUTE 'ALTER FUNCTION public.release_upload_pending_storage_cleanup(text, text, timestamp without time zone, integer) OWNER TO life_ustc_function_owner';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_maintenance_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_upload_pending_storage_cleanup(timestamp without time zone, integer, integer), public.finalize_upload_pending_storage_cleanup(text, text), public.release_upload_pending_storage_cleanup(text, text, timestamp without time zone, integer) TO life_ustc_maintenance_runtime';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_upload_pending_storage_cleanup(timestamp without time zone, integer, integer), public.finalize_upload_pending_storage_cleanup(text, text), public.release_upload_pending_storage_cleanup(text, text, timestamp without time zone, integer) TO life_ustc_runtime';
  END IF;
END $$;
