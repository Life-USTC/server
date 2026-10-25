-- Static snapshots own catalog facts; no authentication or personal data grants.
GRANT SELECT, INSERT, UPDATE ON TABLE
  "Semester",
  "Department",
  "Course",
  "CourseCategory",
  "CourseClassify",
  "CourseGradation",
  "CourseType",
  "EducationLevel",
  "ClassType",
  "ExamMode",
  "TeachLanguage",
  "Campus",
  "RoomType",
  "Building",
  "Room",
  "AdminClass",
  "TeacherTitle",
  "TeacherLessonType",
  "ExamBatch",
  "Teacher",
  "Section",
  "ScheduleGroup",
  "Schedule",
  "Exam",
  "TeacherAssignment",
  "ExamRoom",
  "SectionTeacher",
  "YoungEvent",
  "YoungOrganizer",
  "StaticImportState",
  "_SectionTeachers",
  "_SectionAdminClasses",
  "_ScheduleTeachers"
TO life_ustc_importer;

GRANT DELETE ON TABLE
  "ScheduleGroup", "Schedule", "Exam", "TeacherAssignment", "ExamRoom",
  "_SectionTeachers", "_SectionAdminClasses", "_ScheduleTeachers"
TO life_ustc_importer;

GRANT USAGE ON SEQUENCE
  "Semester_id_seq",
  "Department_id_seq",
  "Course_id_seq",
  "CourseCategory_id_seq",
  "CourseClassify_id_seq",
  "CourseGradation_id_seq",
  "CourseType_id_seq",
  "EducationLevel_id_seq",
  "ClassType_id_seq",
  "ExamMode_id_seq",
  "TeachLanguage_id_seq",
  "Campus_id_seq",
  "RoomType_id_seq",
  "Building_id_seq",
  "Room_id_seq",
  "AdminClass_id_seq",
  "TeacherTitle_id_seq",
  "TeacherLessonType_id_seq",
  "ExamBatch_id_seq",
  "Teacher_id_seq",
  "Section_id_seq",
  "ScheduleGroup_id_seq",
  "Schedule_id_seq",
  "Exam_id_seq",
  "TeacherAssignment_id_seq",
  "ExamRoom_id_seq",
  "SectionTeacher_id_seq",
  "YoungEvent_id_seq"
TO life_ustc_importer;

GRANT INSERT ("id", "action", "outcome", "channel", "targetId", "targetType", "metadata", "createdAt")
ON TABLE "AuditLog" TO life_ustc_importer;
