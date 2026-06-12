type CommentRouteTargetSource = {
  course?: { jwId?: number | null; nameCn?: string | null } | null;
  courseId?: number | null;
  homework?: {
    id?: string | null;
    section?: { code?: string | null; jwId?: number | null } | null;
    title?: string | null;
  } | null;
  section?: { code?: string | null; jwId?: number | null } | null;
  sectionId?: number | null;
  sectionTeacher?: {
    section?: {
      code?: string | null;
      course?: { jwId?: number | null; nameCn?: string | null } | null;
      jwId?: number | null;
    } | null;
    sectionId?: number | null;
    teacher?: { nameCn?: string | null } | null;
    teacherId?: number | null;
  } | null;
  sectionTeacherId?: number | null;
  teacher?: { nameCn?: string | null } | null;
  teacherId?: number | null;
};

export function buildCommentRouteTarget(comment: CommentRouteTargetSource) {
  return {
    sectionId: comment.sectionId ?? null,
    courseId: comment.courseId ?? null,
    teacherId: comment.teacherId ?? null,
    sectionTeacherId: comment.sectionTeacherId ?? null,
    sectionTeacherSectionId: comment.sectionTeacher?.sectionId ?? null,
    sectionTeacherTeacherId: comment.sectionTeacher?.teacherId ?? null,
    sectionTeacherSectionJwId: comment.sectionTeacher?.section?.jwId ?? null,
    sectionTeacherSectionCode: comment.sectionTeacher?.section?.code ?? null,
    sectionTeacherTeacherName: comment.sectionTeacher?.teacher?.nameCn ?? null,
    sectionTeacherCourseJwId:
      comment.sectionTeacher?.section?.course?.jwId ?? null,
    sectionTeacherCourseName:
      comment.sectionTeacher?.section?.course?.nameCn ?? null,
    homeworkId: comment.homework?.id ?? null,
    homeworkTitle: comment.homework?.title ?? null,
    homeworkSectionJwId: comment.homework?.section?.jwId ?? null,
    homeworkSectionCode: comment.homework?.section?.code ?? null,
    sectionJwId: comment.section?.jwId ?? null,
    sectionCode: comment.section?.code ?? null,
    courseJwId: comment.course?.jwId ?? null,
    courseName: comment.course?.nameCn ?? null,
    teacherName: comment.teacher?.nameCn ?? null,
  };
}
