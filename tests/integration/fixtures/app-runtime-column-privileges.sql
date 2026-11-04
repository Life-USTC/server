\set ON_ERROR_STOP on

-- Checked-in app-runtime column privilege contract. Keep sorted like the exporter.
SELECT string_agg(
  privilege,
  ',' ORDER BY split_part(privilege, ':', 1) COLLATE "C",
    split_part(privilege, ':', 2) COLLATE "C"
)
FROM (
  VALUES
    ('public.Description.content:UPDATE'),
    ('public.Description.lastEditedAt:UPDATE'),
    ('public.Description.lastEditedById:UPDATE'),
    ('public.Description.updatedAt:UPDATE'),
    ('public.Homework.deletedAt:UPDATE'),
    ('public.Homework.deletedById:UPDATE'),
    ('public.Homework.isMajor:UPDATE'),
    ('public.Homework.publishedAt:UPDATE'),
    ('public.Homework.requiresTeam:UPDATE'),
    ('public.Homework.submissionDueAt:UPDATE'),
    ('public.Homework.submissionStartAt:UPDATE'),
    ('public.Homework.title:UPDATE'),
    ('public.Homework.updatedAt:UPDATE'),
    ('public.Homework.updatedById:UPDATE'),
    ('public.SectionTeacher.retiredAt:UPDATE'),
    ('public.SectionTeacher.updatedAt:UPDATE'),
    ('public.User.calendarFeedToken:UPDATE'),
    ('public.User.isAdmin:UPDATE'),
    ('public.User.name:UPDATE'),
    -- OAuth hooks and profile completion append trusted, server-derived avatar
    -- URLs; Better Auth's role stays unable to write this column.
    ('public.User.profilePictures:UPDATE'),
    ('public.User.updatedAt:UPDATE'),
    ('public.User.username:UPDATE')
) AS allowlist(privilege);
