import type { CommentTargetLookupRecord } from "./comment-read-model";
import type { CommentTargetType, ResolvedCommentTarget } from "./comment-utils";

export function commentListTargetPayload(
  targetType: CommentTargetType,
  target: ResolvedCommentTarget,
) {
  return {
    type: targetType,
    targetId: target.targetId,
    sectionId: target.sectionId,
    teacherId: target.teacherId,
    sectionTeacherId: target.sectionTeacherId,
    homeworkId: target.homeworkId,
  };
}

export function commentThreadTargetPayload(comment: CommentTargetLookupRecord) {
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
