-- Shared app-runtime grants for catalog reads, owner RLS tables, and community writes.
-- Included by production and CI runtime bootstrap scripts after revoking old grants.
-- New relations require an explicit access decision; migration metadata and
-- authentication tables are not part of application reads.

GRANT SELECT ON TABLE
  "AdminClass",
  "AuditLog",
  "Building",
  "BusCampus",
  "BusRoute",
  "BusRouteStop",
  "BusScheduleVersion",
  "BusTrip",
  "BusUserPreference",
  "Campus",
  "CatalogLinkClick",
  "ClassType",
  "Comment",
  "CommentAttachment",
  "CommentReaction",
  "Course",
  "CourseAlias",
  "CourseCategory",
  "CourseClassify",
  "CourseGradation",
  "CourseType",
  "Department",
  "Description",
  "DescriptionEdit",
  "EducationLevel",
  "Exam",
  "ExamBatch",
  "ExamMode",
  "ExamRoom",
  "FeatureOperationEvent",
  "Homework",
  "HomeworkCompletion",
  "IngestionBatch",
  "IngestionBatchObject",
  "IngestionRun",
  "OAuthGrantUsageDaily",
  "Publication",
  "PublicationEventOutbox",
  "PublicationImageSource",
  "PublicationObject",
  "PublicationObjectLink",
  "PublicationRevision",
  "PublicationRevisionImageSource",
  "PublicationSource",
  "Room",
  "RoomType",
  "RuntimeIssueEvent",
  "Schedule",
  "ScheduleGroup",
  "Section",
  "SectionTeacher",
  "Semester",
  "StaticImportState",
  "TeachLanguage",
  "Teacher",
  "TeacherAssignment",
  "TeacherLessonType",
  "TeacherTitle",
  "Todo",
  "Upload",
  "UploadPending",
  "User",
  "UserSectionSubscription",
  "UserSuspension",
  "UserUstcIdentity",
  "UserYoungEventSubscription",
  "UserYoungOrganizerSubscription",
  "WeatherObservation",
  "WorkspaceLinkPin",
  "YoungEvent",
  "YoungNotification",
  "YoungOrganizer",
  "_ScheduleTeachers",
  "_SectionAdminClasses",
  "_SectionTeachers"
TO life_ustc_runtime;

-- Only runtime writers may allocate IDs. Catalog import and auth sequences
-- belong to their separate database identities.
GRANT USAGE, SELECT ON SEQUENCE
  "BusRouteStop_id_seq",
  "BusScheduleVersion_id_seq",
  "BusTrip_id_seq",
  "SectionTeacher_id_seq"
TO life_ustc_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "Todo",
  "CatalogLinkClick",
  "WorkspaceLinkPin",
  "BusUserPreference",
  "UserUstcIdentity",
  "UserSectionSubscription",
  "UserYoungEventSubscription",
  "UserYoungOrganizerSubscription",
  "YoungNotification",
  "Upload",
  "UploadPending",
  "HomeworkCompletion"
TO life_ustc_runtime;
GRANT SELECT ON TABLE "OAuthGrantUsageDaily" TO life_ustc_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE "CommentReaction"
TO life_ustc_runtime;

-- Comment creation materializes the target for a verified teaching assignment.
-- Existing identities remain immutable; only lifecycle timestamps can change.
GRANT INSERT ON TABLE "SectionTeacher" TO life_ustc_runtime;
GRANT UPDATE ("retiredAt", "updatedAt") ON TABLE "SectionTeacher" TO life_ustc_runtime;

GRANT SELECT, INSERT, UPDATE ON TABLE "Comment" TO life_ustc_runtime;
GRANT INSERT, DELETE ON TABLE "CommentAttachment" TO life_ustc_runtime;
GRANT INSERT, UPDATE ON TABLE "Homework" TO life_ustc_runtime;
GRANT INSERT, UPDATE, DELETE ON TABLE "Description" TO life_ustc_runtime;
GRANT INSERT ON TABLE "DescriptionEdit" TO life_ustc_runtime;
GRANT INSERT ON TABLE "AuditLog" TO life_ustc_runtime;
GRANT INSERT ON TABLE
  "FeatureOperationEvent",
  "RuntimeIssueEvent"
TO life_ustc_runtime;

-- The weather writer upserts hourly observations through the app runtime.
GRANT SELECT, INSERT, UPDATE ON TABLE "WeatherObservation"
TO life_ustc_runtime;

GRANT SELECT, INSERT, UPDATE ON TABLE "UserSuspension" TO life_ustc_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE
  "PublicationSource",
  "Publication",
  "PublicationRevision",
  "PublicationImageSource",
  "PublicationRevisionImageSource",
  "PublicationObject",
  "PublicationObjectLink",
  "IngestionRun",
  "IngestionBatch",
  "IngestionBatchObject",
  "PublicationEventOutbox"
TO life_ustc_runtime;

DO $publication_ingestion_runtime_policies$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'PublicationSource',
    'Publication',
    'PublicationRevision',
    'PublicationImageSource',
    'PublicationRevisionImageSource',
    'PublicationObject',
    'PublicationObjectLink',
    'IngestionRun',
    'IngestionBatch',
    'IngestionBatchObject',
    'PublicationEventOutbox'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      table_name || '_runtime_access',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO life_ustc_runtime USING (true) WITH CHECK (true)',
      table_name || '_runtime_access',
      table_name
    );
  END LOOP;
END
$publication_ingestion_runtime_policies$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "BusScheduleVersion"
TO life_ustc_runtime;
GRANT INSERT, UPDATE ON TABLE "BusCampus", "BusRoute"
TO life_ustc_runtime;
GRANT INSERT, DELETE ON TABLE "BusRouteStop", "BusTrip"
TO life_ustc_runtime;
GRANT UPDATE ("name", "username", "profilePictures", "isAdmin", "calendarFeedToken", "updatedAt") ON TABLE "User"
TO life_ustc_runtime;
