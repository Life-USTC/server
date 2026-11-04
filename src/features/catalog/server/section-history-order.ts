import type { Prisma } from "@/generated/prisma/client";

// Upstream semester IDs are identities, not dates (for example 2006 autumn is
// 48 while 2009 autumn is 47). Sort in SQL before limiting any history page.
// Unknown dates follow dated semesters; IDs only break equal-date ties.
const SEMESTER_HISTORY_ORDER = [
  { semester: { startDate: { sort: "desc", nulls: "last" } } },
  { semester: { jwId: "desc" } },
] satisfies Prisma.SectionOrderByWithRelationInput[];

export const COURSE_SECTION_HISTORY_ORDER = [
  ...SEMESTER_HISTORY_ORDER,
  { code: "asc" },
  { jwId: "asc" },
] satisfies Prisma.SectionOrderByWithRelationInput[];

export const TEACHER_SECTION_HISTORY_ORDER = [
  ...SEMESTER_HISTORY_ORDER,
  { course: { nameCn: "asc" } },
  { jwId: "asc" },
] satisfies Prisma.SectionOrderByWithRelationInput[];

export const SECTION_HISTORY_ORDER = [
  ...SEMESTER_HISTORY_ORDER,
  { jwId: "asc" },
] satisfies Prisma.SectionOrderByWithRelationInput[];
