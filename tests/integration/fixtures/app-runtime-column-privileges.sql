\set ON_ERROR_STOP on

-- Checked-in app-runtime column privilege contract. Keep sorted like the exporter.
SELECT string_agg(
  privilege,
  ',' ORDER BY split_part(privilege, ':', 1) COLLATE "C",
    split_part(privilege, ':', 2) COLLATE "C"
)
FROM (
  VALUES
    ('public.User.calendarFeedToken:UPDATE'),
    ('public.User.isAdmin:UPDATE'),
    ('public.User.name:UPDATE'),
    -- OAuth hooks and profile completion append trusted, server-derived avatar
    -- URLs; Better Auth's role stays unable to write this column.
    ('public.User.profilePictures:UPDATE'),
    ('public.User.updatedAt:UPDATE'),
    ('public.User.username:UPDATE')
) AS allowlist(privilege);
