import type { AppLocale } from "@/i18n/config";
import { parseInteger } from "@/lib/integers";
import { getDemoSubscribedSections } from "./demo-subscriptions";

type TargetInput = {
  targetType: string;
  targetId?: string;
  sectionId?: string;
  sectionJwId?: string;
  courseJwId?: string;
  teacherId?: string;
  sectionTeacherId?: string;
  homeworkId?: string;
  youngId?: string;
};

const matches = (value: string | undefined, id: number) =>
  value === undefined || parseInteger(value) === id;

/** Resolve only the catalog samples; identifiers never fall through to real data. */
export function resolveDemoCatalogTarget(
  input: TargetInput,
  locale: AppLocale,
) {
  const allowedSelectors: Record<string, readonly string[]> = {
    section: ["targetId", "sectionJwId"],
    course: ["targetId", "courseJwId"],
    teacher: ["targetId", "teacherId"],
    "section-teacher": ["sectionId", "sectionJwId", "teacherId"],
  };
  const allowed = allowedSelectors[input.targetType];
  if (!allowed) return null;
  for (const key of [
    "targetId",
    "sectionId",
    "sectionJwId",
    "courseJwId",
    "teacherId",
    "sectionTeacherId",
    "homeworkId",
    "youngId",
  ] as const) {
    if (input[key] !== undefined && !allowed.includes(key)) return null;
  }
  const samples = getDemoSubscribedSections(locale);
  const type = input.targetType;
  const section =
    type === "section" || type === "section-teacher"
      ? samples.find((section) => {
          const rawId = type === "section" ? input.targetId : input.sectionId;
          return (
            (rawId !== undefined || input.sectionJwId !== undefined) &&
            matches(rawId, section.id) &&
            matches(input.sectionJwId, section.jwId)
          );
        })
      : null;
  const course =
    type === "course"
      ? samples.find(
          (section) =>
            (input.targetId !== undefined || input.courseJwId !== undefined) &&
            matches(input.targetId, section.course.id) &&
            matches(input.courseJwId, section.course.jwId),
        )?.course
      : section?.course;
  const teacher =
    type === "teacher"
      ? samples
          .flatMap((section) => section.teachers)
          .find(
            (teacher) =>
              (input.targetId !== undefined || input.teacherId !== undefined) &&
              matches(input.targetId, teacher.id) &&
              matches(input.teacherId, teacher.id),
          )
      : type === "section-teacher" &&
          input.teacherId !== undefined &&
          input.targetId === undefined
        ? section?.teachers.find((teacher) =>
            matches(input.teacherId, teacher.id),
          )
        : null;
  if (
    (type === "section" && !section) ||
    (type === "course" && !course) ||
    (type === "teacher" && !teacher) ||
    (type === "section-teacher" && (!section || !teacher)) ||
    !["section", "course", "teacher", "section-teacher"].includes(type)
  )
    return null;
  return {
    type,
    targetId:
      type === "section"
        ? (section?.id ?? null)
        : type === "course"
          ? (course?.id ?? null)
          : type === "teacher"
            ? (teacher?.id ?? null)
            : null,
    courseId: type === "course" ? (course?.id ?? null) : null,
    sectionId: section?.id ?? null,
    teacherId: teacher?.id ?? null,
    sectionTeacherId: null,
    homeworkId: null,
    youngEventId: null,
    youngId: null,
    sectionTeacherSectionId:
      type === "section-teacher" ? (section?.id ?? null) : null,
    sectionTeacherTeacherId:
      type === "section-teacher" ? (teacher?.id ?? null) : null,
    sectionTeacherSectionJwId:
      type === "section-teacher" ? (section?.jwId ?? null) : null,
    sectionTeacherSectionCode:
      type === "section-teacher" ? (section?.code ?? null) : null,
    sectionTeacherTeacherName:
      type === "section-teacher" ? (teacher?.namePrimary ?? null) : null,
    sectionTeacherCourseJwId:
      type === "section-teacher" ? (course?.jwId ?? null) : null,
    sectionTeacherCourseName:
      type === "section-teacher" ? (course?.namePrimary ?? null) : null,
    homeworkTitle: null,
    homeworkSectionJwId: null,
    homeworkSectionCode: null,
    sectionJwId: section?.jwId ?? null,
    sectionCode: section?.code ?? null,
    courseJwId: course?.jwId ?? null,
    courseName: course?.namePrimary ?? null,
    teacherName: teacher?.namePrimary ?? null,
    youngEventName: null,
  };
}
