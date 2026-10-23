\set ON_ERROR_STOP on

-- Checked-in app-runtime sequence privilege contract. Keep sorted like the exporter.
SELECT string_agg(
  privilege,
  ',' ORDER BY split_part(privilege, ':', 1) COLLATE "C",
    split_part(privilege, ':', 2) COLLATE "C"
)
FROM (
  VALUES
    ('public.BusRouteStop_id_seq:SELECT'),
    ('public.BusRouteStop_id_seq:USAGE'),
    ('public.BusScheduleVersion_id_seq:SELECT'),
    ('public.BusScheduleVersion_id_seq:USAGE'),
    ('public.BusTrip_id_seq:SELECT'),
    ('public.BusTrip_id_seq:USAGE'),
    ('public.SectionTeacher_id_seq:SELECT'),
    ('public.SectionTeacher_id_seq:USAGE')
) AS allowlist(privilege);
