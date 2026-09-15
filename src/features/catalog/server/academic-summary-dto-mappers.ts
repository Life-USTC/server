import {
  type CourseDto,
  courseSchema,
} from "@/features/catalog/lib/academic-course-response-schemas";
import {
  type CourseDetailDto,
  courseDetailSchema,
  type SectionCompactDto,
  type SectionPublicContextDto,
  type SectionSummaryDto,
  sectionCompactSchema,
  sectionPublicContextSchema,
  sectionSummarySchema,
  type TeacherDetailDto,
  teacherDetailSchema,
} from "@/features/catalog/lib/academic-section-list-response-schemas";
import {
  type TeacherListDto,
  teacherListSchema,
} from "@/features/catalog/lib/academic-teacher-response-schemas";
import type {
  courseDetailInclude,
  courseInclude,
  sectionCompactInclude,
  sectionPublicContextSelect,
  sectionSummarySelect,
  teacherPublicDetailSelect,
  teacherPublicListSelect,
} from "@/features/catalog/server/academic-query-includes";
import type { Prisma, Section } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { toLocalizedNameDto } from "@/lib/localized-name";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export type CourseSummaryRecord = Prisma.CourseGetPayload<{
  include: typeof courseInclude;
}>;

export type CourseDetailRecord = Prisma.CourseGetPayload<{
  include: typeof courseDetailInclude;
}>;

export type SectionCompactRecord = Prisma.SectionGetPayload<{
  include: typeof sectionCompactInclude;
}>;

export type SectionSummaryRecord = Prisma.SectionGetPayload<{
  select: typeof sectionSummarySelect;
}>;

export type SectionPublicContextRecord = Prisma.SectionGetPayload<{
  select: typeof sectionPublicContextSelect;
}>;

export type TeacherListRecord = Prisma.TeacherGetPayload<{
  select: typeof teacherPublicListSelect;
}>;

export type TeacherDetailRecord = Prisma.TeacherGetPayload<{
  select: typeof teacherPublicDetailSelect;
}>;

function toCourseRelationDto(
  input: CourseSummaryRecord["category"],
  locale: AppLocale,
) {
  return input
    ? {
        id: input.id,
        ...toLocalizedNameDto(input, locale),
      }
    : null;
}

export function toCourseDto(
  input: CourseSummaryRecord,
  locale: AppLocale,
): CourseDto {
  return courseSchema.parse({
    id: input.id,
    jwId: input.jwId,
    code: input.code,
    ...toLocalizedNameDto(input, locale),
    categoryId: input.categoryId,
    classTypeId: input.classTypeId,
    classifyId: input.classifyId,
    educationLevelId: input.educationLevelId,
    gradationId: input.gradationId,
    typeId: input.typeId,
    category: toCourseRelationDto(input.category, locale),
    classType: toCourseRelationDto(input.classType, locale),
    classify: toCourseRelationDto(input.classify, locale),
    educationLevel: toCourseRelationDto(input.educationLevel, locale),
    gradation: toCourseRelationDto(input.gradation, locale),
    type: toCourseRelationDto(input.type, locale),
  });
}

function sectionBaseDto(input: Section) {
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

function semesterDto(input: SectionCompactRecord["semester"]) {
  return input
    ? {
        id: input.id,
        jwId: input.jwId,
        nameCn: input.nameCn,
        code: input.code,
        startDate: input.startDate
          ? toShanghaiIsoString(input.startDate)
          : null,
        endDate: input.endDate ? toShanghaiIsoString(input.endDate) : null,
      }
    : null;
}

function campusDto(input: SectionCompactRecord["campus"], locale: AppLocale) {
  return input
    ? {
        id: input.id,
        jwId: input.jwId,
        code: input.code,
        ...toLocalizedNameDto(input, locale),
      }
    : null;
}

function teacherIdentityDto(
  input: SectionCompactRecord["teachers"][number],
  locale: AppLocale,
) {
  return {
    id: input.id,
    jwId: input.jwId,
    personId: input.personId,
    code: input.code,
    ...toLocalizedNameDto(input, locale),
  };
}

export function toSectionCompactDto(
  input: SectionCompactRecord,
  locale: AppLocale,
): SectionCompactDto {
  return sectionCompactSchema.parse({
    ...sectionBaseDto(input),
    course: toCourseDto(input.course, locale),
    semester: semesterDto(input.semester),
    campus: campusDto(input.campus, locale),
    openDepartment: input.openDepartment
      ? {
          id: input.openDepartment.id,
          jwId: input.openDepartment.jwId,
          code: input.openDepartment.code,
          isCollege: input.openDepartment.isCollege,
          ...toLocalizedNameDto(input.openDepartment, locale),
        }
      : null,
    teachers: input.teachers.map((teacher) =>
      teacherIdentityDto(teacher, locale),
    ),
  });
}

export function toCourseDetailDto(
  input: CourseDetailRecord,
  locale: AppLocale,
): CourseDetailDto {
  return courseDetailSchema.parse({
    ...toCourseDto(input, locale),
    sections: input.sections.map((section) => ({
      ...sectionBaseDto(section),
      semester: semesterDto(section.semester),
      campus: campusDto(section.campus, locale),
      teachers: section.teachers.map((teacher) =>
        teacherIdentityDto(teacher, locale),
      ),
    })),
    _count: { sections: input._count.sections },
  });
}

export function toSectionSummaryDto(
  input: SectionSummaryRecord,
  locale: AppLocale,
): SectionSummaryDto {
  return sectionSummarySchema.parse({
    id: input.id,
    jwId: input.jwId,
    code: input.code,
    credits: input.credits,
    stdCount: input.stdCount,
    limitCount: input.limitCount,
    courseId: input.courseId,
    semesterId: input.semesterId,
    campusId: input.campusId,
    openDepartmentId: input.openDepartmentId,
    course: {
      id: input.course.id,
      jwId: input.course.jwId,
      code: input.course.code,
      ...toLocalizedNameDto(input.course, locale),
    },
    semester: input.semester
      ? {
          id: input.semester.id,
          jwId: input.semester.jwId,
          nameCn: input.semester.nameCn,
          code: input.semester.code,
        }
      : null,
    campus: input.campus
      ? {
          id: input.campus.id,
          jwId: input.campus.jwId,
          ...toLocalizedNameDto(input.campus, locale),
          code: input.campus.code,
        }
      : null,
    teachers: input.teachers.map((teacher) => ({
      id: teacher.id,
      jwId: teacher.jwId,
      personId: teacher.personId,
      code: teacher.code,
      ...toLocalizedNameDto(teacher, locale),
    })),
  });
}

export function toSectionPublicContextDto(
  input: SectionPublicContextRecord,
  locale: AppLocale,
): SectionPublicContextDto {
  return sectionPublicContextSchema.parse({
    id: input.id,
    jwId: input.jwId,
    code: input.code,
    course: {
      jwId: input.course.jwId,
      code: input.course.code,
      ...toLocalizedNameDto(input.course, locale),
    },
    semester: input.semester
      ? {
          jwId: input.semester.jwId,
          code: input.semester.code,
          nameCn: input.semester.nameCn,
        }
      : null,
  });
}

export function toTeacherListDto(
  input: TeacherListRecord,
  locale: AppLocale,
): TeacherListDto {
  return teacherListSchema.parse({
    id: input.id,
    jwId: input.jwId,
    personId: input.personId,
    code: input.code,
    ...toLocalizedNameDto(input, locale),
    email: input.email,
    telephone: input.telephone,
    mobile: input.mobile,
    address: input.address,
    departmentId: input.departmentId,
    teacherTitleId: input.teacherTitleId,
    department: input.department
      ? {
          id: input.department.id,
          code: input.department.code,
          isCollege: input.department.isCollege,
          ...toLocalizedNameDto(input.department, locale),
        }
      : null,
    teacherTitle: input.teacherTitle
      ? {
          id: input.teacherTitle.id,
          jwId: input.teacherTitle.jwId,
          code: input.teacherTitle.code,
          enabled: input.teacherTitle.enabled,
          ...toLocalizedNameDto(input.teacherTitle, locale),
        }
      : null,
    _count: { sections: input._count.sections },
  });
}

export function toTeacherDetailDto(
  input: TeacherDetailRecord,
  locale: AppLocale,
): TeacherDetailDto {
  return teacherDetailSchema.parse({
    ...toTeacherListDto(input, locale),
    sections: input.sections.map((section) => ({
      ...sectionBaseDto(section),
      course: toCourseDto(section.course, locale),
      semester: semesterDto(section.semester),
    })),
  });
}
