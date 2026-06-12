import type { Prisma } from "@/generated/prisma/client";
import { sectionPageExamSelect } from "@/lib/section-page-exam-select";
import {
  entityNameSelect,
  localizedNameSelect,
} from "@/lib/section-page-name-selects";
import { sectionPageScheduleSelect } from "@/lib/section-page-schedule-select";

export const sectionPageSelect = {
  id: true,
  jwId: true,
  code: true,
  credits: true,
  period: true,
  actualPeriods: true,
  theoryPeriods: true,
  practicePeriods: true,
  experimentPeriods: true,
  machinePeriods: true,
  designPeriods: true,
  testPeriods: true,
  graduateAndPostgraduate: true,
  timesPerWeek: true,
  periodsPerWeek: true,
  stdCount: true,
  limitCount: true,
  dateTimePlaceText: true,
  scheduleRemark: true,
  remark: true,
  courseId: true,
  semesterId: true,
  course: {
    select: {
      id: true,
      jwId: true,
      ...localizedNameSelect,
    },
  },
  semester: { select: { endDate: true, nameCn: true, startDate: true } },
  campus: {
    select: localizedNameSelect,
  },
  openDepartment: {
    select: localizedNameSelect,
  },
  examMode: {
    select: localizedNameSelect,
  },
  teachLanguage: {
    select: localizedNameSelect,
  },
  roomType: {
    select: localizedNameSelect,
  },
  description: {
    select: { content: true, updatedAt: true, lastEditedAt: true },
  },
  teachers: {
    select: {
      ...entityNameSelect,
      department: {
        select: localizedNameSelect,
      },
    },
  },
  adminClasses: {
    select: {
      ...entityNameSelect,
      code: true,
    },
  },
  schedules: sectionPageScheduleSelect,
  exams: sectionPageExamSelect,
} satisfies Prisma.SectionSelect;
