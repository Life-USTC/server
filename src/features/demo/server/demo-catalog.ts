import { PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT } from "@/features/catalog/server/academic-query-includes";
import type { DescriptionPayload } from "@/features/descriptions/lib/description-payload-types";
import type { SectionDetailSection } from "@/features/section-detail/lib/section-detail-controller-types";
import type { AppLocale } from "@/i18n/config";
import type { SectionDetailDto } from "@/lib/api/schemas/academic-section-detail-response-schemas";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { demoHomeworkSummary, getDemoHomeworks } from "./demo-homeworks";
import { getDemoSubscribedSections } from "./demo-subscriptions";

export function getDemoCatalogViewer(): ViewerContext {
  return {
    userId: null,
    name: null,
    image: null,
    isAdmin: false,
    isAuthenticated: false,
    isSuspended: false,
    suspensionReason: null,
    suspensionExpiresAt: null,
  };
}

export function getDemoCatalogSection(
  jwId: number,
  locale: AppLocale,
  options?: {
    includeExams?: boolean;
    includeSchedules?: boolean;
    includeTeacherDepartments?: boolean;
  },
): SectionDetailDto | null {
  const sample = getDemoSubscribedSections(locale).find(
    (section) => section.jwId === jwId,
  );
  if (!sample) return null;
  const { kind: _kind, ...section } = sample;
  const autumn = section.semesterId === 2609;
  const partial =
    options != null &&
    Object.values(options).some((value) => value !== undefined);
  return {
    ...section,
    examMode: null,
    teachLanguage: null,
    roomType: null,
    adminClasses: [],
    teachers: section.teachers.map((teacher) => ({
      ...teacher,
      department: null,
      teacherTitle: null,
    })),
    teacherAssignments: [],
    scheduleGroups:
      partial && !options?.includeSchedules
        ? []
        : [
            {
              id: 500 + section.id,
              jwId: 940000 + section.id,
              no: 1,
              limitCount: 40,
              stdCount: 30,
              actualPeriods: 2,
              isDefault: true,
              sectionId: section.id,
            },
          ],
    schedules:
      partial && !options?.includeSchedules
        ? []
        : [
            {
              id: 600 + section.id,
              periods: 2,
              date: autumn
                ? "2026-09-24T00:00:00+08:00"
                : "2026-03-12T00:00:00+08:00",
              weekday: 4,
              startTime: "800",
              endTime: "945",
              experiment: null,
              customPlace: locale === "en-us" ? "Demo classroom" : "演示教室",
              lessonType: null,
              weekIndex: autumn ? 4 : 3,
              exerciseClass: false,
              startUnit: 1,
              endUnit: 2,
              roomId: null,
              sectionId: section.id,
              scheduleGroupId: 500 + section.id,
            },
          ],
    exams:
      partial && !options?.includeExams
        ? []
        : [
            {
              id: 700 + section.id,
              jwId: 950000 + section.id,
              examType: null,
              startTime: 1400,
              endTime: 1600,
              examDate: autumn
                ? "2027-01-08T00:00:00+08:00"
                : "2026-06-26T00:00:00+08:00",
              examTakeCount: 30,
              examMode: locale === "en-us" ? "Written examination" : "笔试",
              grades: null,
              adminClassNames: null,
              monitors: null,
              examBatchId: null,
              sectionId: section.id,
              examBatch: null,
              examRooms: [],
            },
          ],
  };
}

export function getDemoCatalogSectionPage(jwId: number, locale: AppLocale) {
  const section = getDemoCatalogSection(jwId, locale);
  if (!section) return null;
  return {
    description: buildDemoCatalogDescription("section", section.id, locale)
      .description,
    section: {
      ...section,
      schedules: section.schedules.map((schedule) => ({
        ...schedule,
        startTime: Number(schedule.startTime),
        endTime: Number(schedule.endTime),
        teachers: section.teachers,
      })),
      examCount: section.exams.length,
      scheduleCount: section.schedules.length,
      otherCourseSectionCount: 0,
      otherCourseSections: [],
    } satisfies SectionDetailSection,
  };
}

export function getDemoCatalogPersonal(
  jwId: number,
  locale: AppLocale,
  focusedHomeworkId: string | null = null,
) {
  const section = getDemoCatalogSection(jwId, locale);
  if (!section) return null;
  const homeworks = getDemoHomeworks(locale).filter(
    (homework) => homework.sectionId === section.id,
  );
  if (
    focusedHomeworkId !== null &&
    !homeworks.some((homework) => homework.id === focusedHomeworkId)
  )
    return null;
  return {
    viewer: { signedIn: false, isSubscribed: true },
    homeworkData: {
      homeworks: homeworks.map((homework) => {
        if (homework.id !== focusedHomeworkId)
          return demoHomeworkSummary(homework);
        const { section: _section, ...detail } = homework;
        return detail;
      }),
      auditLogs: [],
      viewer: {
        isAdmin: false,
        isAuthenticated: false,
        isSuspended: false,
        userId: null,
      },
    },
  };
}

export function getDemoCatalogCourse(
  jwId: number,
  locale: AppLocale,
  page = 1,
) {
  const samples = getDemoSubscribedSections(locale);
  const course = samples.find(
    (section) => section.course.jwId === jwId,
  )?.course;
  if (!course) return null;
  const sections = samples.filter((section) => section.course.jwId === jwId);
  return {
    ...course,
    sections: sections.slice(
      (page - 1) * PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
      page * PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
    ),
    _count: { sections: sections.length },
  };
}

export function getDemoCatalogTeacher(id: number, locale: AppLocale, page = 1) {
  const samples = getDemoSubscribedSections(locale);
  const teacher = samples
    .flatMap((section) => section.teachers)
    .find((teacher) => teacher.id === id);
  if (!teacher) return null;
  const sections = samples.filter((section) =>
    section.teachers.some((teacher) => teacher.id === id),
  );
  return {
    ...teacher,
    address: null,
    email: null,
    telephone: null,
    mobile: null,
    department: null,
    teacherTitle: null,
    sections: sections.slice(
      (page - 1) * PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
      page * PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
    ),
    _count: { sections: sections.length },
  };
}

export function buildDemoCatalogDescription(
  type: string,
  id: number,
  locale: AppLocale,
): DescriptionPayload {
  const english = locale === "en-us";
  const content =
    type === "teacher"
      ? english
        ? "Explore the sample teaching sections below."
        : "你可以在下方浏览这位老师的演示教学班。"
      : english
        ? "This sample introduces the course topics. Review the timetable, examination and teaching information below."
        : "这份样例介绍课程内容。你可以继续查看下方的课表、考试与教学信息。";
  return {
    description: {
      id: `demo-description-${type}-${id}`,
      content,
      renderedHtml: `<p>${content}</p>`,
      updatedAt: null,
      lastEditedAt: null,
      lastEditedBy: null,
    },
    history: [],
    viewer: getDemoCatalogViewer(),
  };
}
