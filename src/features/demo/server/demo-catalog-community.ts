import { DEMO_YOUNG_IDS } from "@/features/demo/lib/demo-young-ids";
import type { AppLocale } from "@/i18n/config";
import { parseInteger } from "@/lib/integers";
import { getDemoHomework } from "./demo-homeworks";
import { getDemoSubscribedSections } from "./demo-subscriptions";
import { getDemoYoungEvent } from "./demo-young";

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
    homework: ["targetId", "homeworkId"],
    "young-event": ["targetId", "youngId"],
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
  const youngId = input.youngId ?? input.targetId;
  const youngEvent =
    input.targetType === "young-event" && youngId
      ? getDemoYoungEvent(locale, youngId)
      : null;
  if (
    input.targetType === "young-event" &&
    (!youngEvent ||
      (input.targetId !== undefined && input.targetId !== youngEvent.youngId) ||
      (input.youngId !== undefined && input.youngId !== youngEvent.youngId))
  )
    return null;
  const homeworkId = input.homeworkId ?? input.targetId;
  const homework =
    input.targetType === "homework" && homeworkId
      ? getDemoHomework(homeworkId, locale)
      : null;
  if (
    input.targetType === "homework" &&
    (!homework ||
      (input.targetId !== undefined && input.targetId !== homework.id) ||
      (input.homeworkId !== undefined && input.homeworkId !== homework.id))
  )
    return null;
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
    ![
      "section",
      "course",
      "teacher",
      "section-teacher",
      "homework",
      "young-event",
    ].includes(type)
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
    homeworkId: homework?.id ?? null,
    youngEventId: youngEvent
      ? 700001 + DEMO_YOUNG_IDS.indexOf(youngEvent.youngId)
      : null,
    youngId: youngEvent?.youngId ?? null,
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
    homeworkTitle: homework?.title ?? null,
    homeworkSectionJwId: homework?.section.jwId ?? null,
    homeworkSectionCode: homework?.section.code ?? null,
    sectionJwId: section?.jwId ?? null,
    sectionCode: section?.code ?? null,
    courseJwId: course?.jwId ?? null,
    courseName: course?.namePrimary ?? null,
    teacherName: teacher?.namePrimary ?? null,
    youngEventName: youngEvent?.name ?? null,
  };
}
