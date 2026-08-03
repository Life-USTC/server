import {
  entityNameSelect,
  localizedNameSelect,
} from "@/features/section-detail/server/section-page-name-selects";
import type { Prisma } from "@/generated/prisma/client";

const overviewCampusSelect = {
  id: true,
  ...localizedNameSelect,
} satisfies Prisma.CampusSelect;

const overviewCourseSelect = {
  id: true,
  jwId: true,
  code: true,
  ...localizedNameSelect,
} satisfies Prisma.CourseSelect;

const overviewSemesterSelect = {
  id: true,
  jwId: true,
  code: true,
  nameCn: true,
} satisfies Prisma.SemesterSelect;

const overviewSectionSelect = {
  id: true,
  jwId: true,
  code: true,
  course: { select: overviewCourseSelect },
  semester: { select: overviewSemesterSelect },
} satisfies Prisma.SectionSelect;

const overviewTeacherSelect = {
  id: true,
  code: true,
  ...localizedNameSelect,
} satisfies Prisma.TeacherSelect;

const overviewRoomSelect = {
  id: true,
  jwId: true,
  ...localizedNameSelect,
  building: {
    select: {
      id: true,
      jwId: true,
      ...localizedNameSelect,
      campus: { select: overviewCampusSelect },
    },
  },
} satisfies Prisma.RoomSelect;

export const overviewScheduleSelect = {
  id: true,
  date: true,
  weekday: true,
  startTime: true,
  endTime: true,
  weekIndex: true,
  customPlace: true,
  room: { select: overviewRoomSelect },
  teachers: { select: overviewTeacherSelect },
  section: { select: overviewSectionSelect },
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
  section: { select: overviewSectionSelect },
  examBatch: { select: entityNameSelect },
  examRooms: {
    select: {
      id: true,
      room: true,
      count: true,
    },
  },
} satisfies Prisma.ExamSelect;
