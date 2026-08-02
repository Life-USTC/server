import { sectionSummarySelect } from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";

const localizedNameSelect = {
  id: true,
  nameCn: true,
  nameEn: true,
  namePrimary: true,
  nameSecondary: true,
} as const;

export const overviewScheduleSelect = {
  id: true,
  date: true,
  weekday: true,
  startTime: true,
  endTime: true,
  weekIndex: true,
  customPlace: true,
  room: {
    select: {
      id: true,
      jwId: true,
      nameCn: true,
      nameEn: true,
      code: true,
      building: {
        select: {
          id: true,
          jwId: true,
          nameCn: true,
          nameEn: true,
          code: true,
          campus: { select: sectionSummarySelect.campus.select },
        },
      },
    },
  },
  teachers: {
    select: sectionSummarySelect.teachers.select,
  },
  section: {
    select: {
      id: true,
      jwId: true,
      code: true,
      course: { select: sectionSummarySelect.course.select },
      semester: { select: sectionSummarySelect.semester.select },
      campus: { select: sectionSummarySelect.campus.select },
    },
  },
} satisfies Prisma.ScheduleSelect;

export const overviewExamSelect = {
  id: true,
  jwId: true,
  examDate: true,
  startTime: true,
  endTime: true,
  examType: true,
  examMode: true,
  examTakeCount: true,
  section: {
    select: {
      id: true,
      jwId: true,
      code: true,
      course: { select: sectionSummarySelect.course.select },
      semester: { select: sectionSummarySelect.semester.select },
    },
  },
  examBatch: {
    select: localizedNameSelect,
  },
  examRooms: {
    select: {
      id: true,
      room: true,
      count: true,
    },
  },
} satisfies Prisma.ExamSelect;
