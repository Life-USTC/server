import {
  courseDetailInclude,
  courseInclude,
  sectionCatalogInclude,
  sectionCompactInclude,
  sectionInclude,
  teacherAssignmentPublicSelect,
  teacherPublicReferenceSelect,
} from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  type SectionDetailDto,
  sectionDetailSchema,
} from "@/lib/api/schemas/academic-section-detail-response-schemas";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { getPrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";
import { formatTime } from "@/shared/lib/time-utils";
import {
  type CourseSummaryRecord,
  toCourseDetailDto,
  toCourseDto,
} from "./academic-summary-dto-mappers";

const sectionDetailInclude = {
  ...sectionInclude,
  roomType: true,
  schedules: true,
  scheduleGroups: true,
  teachers: { select: teacherPublicReferenceSelect },
  teacherAssignments: { select: teacherAssignmentPublicSelect },
  exams: {
    include: {
      examBatch: true,
      examRooms: true,
    },
  },
} as const satisfies Prisma.SectionInclude;

export type SectionDetailRecord = Prisma.SectionGetPayload<{
  include: typeof sectionDetailInclude;
}>;

function localizedName(
  input: { nameCn: string; nameEn: string | null },
  locale: AppLocale,
) {
  const nameEn = input.nameEn?.trim() || null;
  return {
    nameCn: input.nameCn,
    nameEn: input.nameEn,
    namePrimary: locale === "en-us" && nameEn ? nameEn : input.nameCn,
    nameSecondary: locale === "en-us" ? (nameEn ? input.nameCn : null) : nameEn,
  };
}

function sectionBaseDto(input: SectionDetailRecord) {
  return {
    id: input.id,
    jwId: input.jwId,
    retiredAt: input.retiredAt ? toShanghaiIsoString(input.retiredAt) : null,
    code: input.code,
    bizTypeId: input.bizTypeId,
    credits: input.credits,
    period: input.period,
    periodsPerWeek: input.periodsPerWeek,
    timesPerWeek: input.timesPerWeek,
    stdCount: input.stdCount,
    limitCount: input.limitCount,
    graduateAndPostgraduate: input.graduateAndPostgraduate,
    dateTimePlaceText: input.dateTimePlaceText,
    dateTimePlacePersonText: input.dateTimePlacePersonText,
    actualPeriods: input.actualPeriods,
    theoryPeriods: input.theoryPeriods,
    practicePeriods: input.practicePeriods,
    experimentPeriods: input.experimentPeriods,
    machinePeriods: input.machinePeriods,
    designPeriods: input.designPeriods,
    testPeriods: input.testPeriods,
    scheduleState: input.scheduleState,
    suggestScheduleWeeks: input.suggestScheduleWeeks,
    suggestScheduleWeekInfo: input.suggestScheduleWeekInfo,
    scheduleJsonParams: input.scheduleJsonParams,
    selectedStdCount: input.selectedStdCount,
    remark: input.remark,
    scheduleRemark: input.scheduleRemark,
    courseId: input.courseId,
    semesterId: input.semesterId,
    campusId: input.campusId,
    examModeId: input.examModeId,
    openDepartmentId: input.openDepartmentId,
    teachLanguageId: input.teachLanguageId,
    roomTypeId: input.roomTypeId,
  };
}

function namedValueDto(
  input: { id: number; nameCn: string; nameEn: string | null } | null,
  locale: AppLocale,
) {
  return input ? { id: input.id, ...localizedName(input, locale) } : null;
}

export function toSectionDetailDto(
  input: SectionDetailRecord,
  locale: AppLocale,
): SectionDetailDto {
  return sectionDetailSchema.parse({
    ...sectionBaseDto(input),
    course: toCourseDto(input.course as CourseSummaryRecord, locale),
    semester: input.semester
      ? {
          id: input.semester.id,
          jwId: input.semester.jwId,
          nameCn: input.semester.nameCn,
          code: input.semester.code,
          startDate: input.semester.startDate
            ? toShanghaiIsoString(input.semester.startDate)
            : null,
          endDate: input.semester.endDate
            ? toShanghaiIsoString(input.semester.endDate)
            : null,
        }
      : null,
    campus: input.campus
      ? {
          id: input.campus.id,
          jwId: input.campus.jwId,
          code: input.campus.code,
          ...localizedName(input.campus, locale),
        }
      : null,
    openDepartment: input.openDepartment
      ? {
          id: input.openDepartment.id,
          jwId: input.openDepartment.jwId,
          code: input.openDepartment.code,
          isCollege: input.openDepartment.isCollege,
          ...localizedName(input.openDepartment, locale),
        }
      : null,
    examMode: namedValueDto(input.examMode, locale),
    teachLanguage: namedValueDto(input.teachLanguage, locale),
    roomType: input.roomType
      ? {
          id: input.roomType.id,
          jwId: input.roomType.jwId,
          code: input.roomType.code,
          ...localizedName(input.roomType, locale),
        }
      : null,
    schedules: input.schedules.map((schedule) => ({
      id: schedule.id,
      periods: schedule.periods,
      date: schedule.date ? toShanghaiIsoString(schedule.date) : null,
      weekday: schedule.weekday,
      startTime: formatTime(schedule.startTime),
      endTime: formatTime(schedule.endTime),
      experiment: schedule.experiment,
      customPlace: schedule.customPlace,
      lessonType: schedule.lessonType,
      weekIndex: schedule.weekIndex,
      exerciseClass: schedule.exerciseClass,
      startUnit: schedule.startUnit,
      endUnit: schedule.endUnit,
      roomId: schedule.roomId,
      sectionId: schedule.sectionId,
      scheduleGroupId: schedule.scheduleGroupId,
    })),
    scheduleGroups: input.scheduleGroups.map((group) => ({
      id: group.id,
      jwId: group.jwId,
      no: group.no,
      limitCount: group.limitCount,
      stdCount: group.stdCount,
      actualPeriods: group.actualPeriods,
      isDefault: group.isDefault,
      sectionId: group.sectionId,
    })),
    teachers: input.teachers.map((teacher) => ({
      id: teacher.id,
      jwId: teacher.jwId,
      personId: teacher.personId,
      code: teacher.code,
      ...localizedName(teacher, locale),
      department: teacher.department
        ? {
            id: teacher.department.id,
            code: teacher.department.code,
            isCollege: teacher.department.isCollege,
            ...localizedName(teacher.department, locale),
          }
        : null,
      teacherTitle: teacher.teacherTitle
        ? {
            id: teacher.teacherTitle.id,
            jwId: teacher.teacherTitle.jwId,
            code: teacher.teacherTitle.code,
            enabled: teacher.teacherTitle.enabled,
            ...localizedName(teacher.teacherTitle, locale),
          }
        : null,
    })),
    teacherAssignments: input.teacherAssignments.map((assignment) => ({
      id: assignment.id,
      teacherId: assignment.teacherId,
      sectionId: assignment.sectionId,
      role: assignment.role,
      period: assignment.period,
      weekIndices: assignment.weekIndices,
      weekIndicesMsg: assignment.weekIndicesMsg,
      teacherLessonTypeId: assignment.teacherLessonTypeId,
      teacherTitleId: assignment.teacherTitleId,
      teacherLessonType: assignment.teacherLessonType
        ? {
            id: assignment.teacherLessonType.id,
            jwId: assignment.teacherLessonType.jwId,
            nameCn: assignment.teacherLessonType.nameCn,
            nameEn: assignment.teacherLessonType.nameEn,
            code: assignment.teacherLessonType.code,
            role: assignment.teacherLessonType.role,
            enabled: assignment.teacherLessonType.enabled,
          }
        : null,
      teacherTitle: assignment.teacherTitle
        ? {
            id: assignment.teacherTitle.id,
            jwId: assignment.teacherTitle.jwId,
            code: assignment.teacherTitle.code,
            enabled: assignment.teacherTitle.enabled,
            ...localizedName(assignment.teacherTitle, locale),
          }
        : null,
    })),
    exams: input.exams.map((exam) => ({
      id: exam.id,
      jwId: exam.jwId,
      examType: exam.examType,
      startTime: exam.startTime,
      endTime: exam.endTime,
      examDate: exam.examDate ? toShanghaiIsoString(exam.examDate) : null,
      examTakeCount: exam.examTakeCount,
      examMode: exam.examMode,
      examBatchId: exam.examBatchId,
      sectionId: exam.sectionId,
      examBatch: exam.examBatch
        ? {
            id: exam.examBatch.id,
            jwId: exam.examBatch.jwId,
            ...localizedName(exam.examBatch, locale),
          }
        : null,
      examRooms: exam.examRooms.map((room) => ({
        id: room.id,
        room: room.room,
        count: room.count,
        examId: room.examId,
      })),
    })),
    adminClasses: input.adminClasses.map((adminClass) => ({
      id: adminClass.id,
      jwId: adminClass.jwId,
      code: adminClass.code,
      grade: adminClass.grade,
      nameCn: adminClass.nameCn,
      nameEn: adminClass.nameEn,
      stdCount: adminClass.stdCount,
      planCount: adminClass.planCount,
      enabled: adminClass.enabled,
      abbrZh: adminClass.abbrZh,
      abbrEn: adminClass.abbrEn,
    })),
  });
}

export async function findCourseDetailByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return cachedPublicDetailRuntimeData({
    id: jwId,
    kind: "course",
    locale,
    shape: "detail-v1",
    load: async () => {
      const course = await getPrisma(locale).course.findUnique({
        where: { jwId },
        include: courseDetailInclude,
      });
      return course ? toCourseDetailDto(course, locale) : null;
    },
  });
}

export async function findCoursesByJwIds(
  jwIds: readonly number[],
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const prisma = getPrisma(locale);
  const requestedJwIds = [...new Set(jwIds)];
  const courses = await prisma.course.findMany({
    where: { jwId: { in: requestedJwIds } },
    include: courseInclude,
  });
  const byJwId = new Map(courses.map((course) => [course.jwId, course]));
  return jwIds.map((jwId) => byJwId.get(jwId) ?? null);
}

export async function findSectionByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    include: sectionInclude,
  });
}

export async function findSectionDetailByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
  options?: {
    includeExams?: boolean;
    includeSchedules?: boolean;
    includeTeacherDepartments?: boolean;
  },
) {
  const hasPartialFlags =
    options != null &&
    (options.includeExams !== undefined ||
      options.includeSchedules !== undefined ||
      options.includeTeacherDepartments !== undefined);

  const shape = hasPartialFlags
    ? `detail-v1:exams=${options.includeExams === true}:schedules=${options.includeSchedules === true}:teacher-departments=${options.includeTeacherDepartments === true}`
    : "detail-v1:full";

  return cachedPublicDetailRuntimeData({
    id: jwId,
    kind: "section",
    locale,
    shape,
    load: async () => {
      if (!hasPartialFlags) {
        const section = await getPrisma(locale).section.findUnique({
          where: { jwId },
          include: sectionDetailInclude,
        });
        return section ? toSectionDetailDto(section, locale) : null;
      }

      const section = await getPrisma(locale).section.findUnique({
        where: { jwId },
        include: buildPartialSectionDetailInclude(options),
      });

      if (!section) return null;

      return {
        ...section,
        exams: "exams" in section && section.exams ? section.exams : [],
        scheduleGroups:
          "scheduleGroups" in section && section.scheduleGroups
            ? section.scheduleGroups
            : [],
        schedules:
          "schedules" in section && section.schedules
            ? section.schedules.map(serializeScheduleTimeFields)
            : [],
        teacherAssignments:
          "teacherAssignments" in section && section.teacherAssignments
            ? section.teacherAssignments
            : [],
        teachers: section.teachers ?? [],
      };
    },
  });
}

function buildPartialSectionDetailInclude(options: {
  includeExams?: boolean;
  includeSchedules?: boolean;
  includeTeacherDepartments?: boolean;
}) {
  const includeExams = options.includeExams === true;
  const includeSchedules = options.includeSchedules === true;
  return {
    ...sectionInclude,
    roomType: true,
    schedules: includeSchedules,
    scheduleGroups: includeSchedules,
    teachers: { select: teacherPublicReferenceSelect },
    teacherAssignments:
      options.includeTeacherDepartments === true
        ? { select: teacherAssignmentPublicSelect }
        : false,
    exams: includeExams
      ? {
          include: {
            examBatch: true,
            examRooms: true,
          },
        }
      : false,
  } as const;
}

export async function findSectionsByJwIds(
  jwIds: readonly number[],
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const sections = await getPrisma(locale).section.findMany({
    where: { jwId: { in: [...new Set(jwIds)] } },
    include: sectionCatalogInclude,
  });
  const byJwId = new Map(sections.map((section) => [section.jwId, section]));
  return jwIds.map((jwId) => byJwId.get(jwId) ?? null);
}

export async function findSectionCompactByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    include: sectionCompactInclude,
  });
}

export function findSectionSummaryByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    select: {
      id: true,
      jwId: true,
      code: true,
      course: {
        select: {
          jwId: true,
          code: true,
          nameCn: true,
          nameEn: true,
        },
      },
      semester: {
        select: {
          jwId: true,
          code: true,
          nameCn: true,
        },
      },
    },
  });
}
