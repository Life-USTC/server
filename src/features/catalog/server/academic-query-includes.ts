import type { Prisma } from "@/generated/prisma/client";

export const sectionSummarySelect = {
  id: true,
  jwId: true,
  code: true,
  credits: true,
  stdCount: true,
  limitCount: true,
  courseId: true,
  semesterId: true,
  campusId: true,
  openDepartmentId: true,
  course: {
    select: {
      id: true,
      jwId: true,
      code: true,
      nameCn: true,
      nameEn: true,
    },
  },
  semester: {
    select: {
      id: true,
      jwId: true,
      nameCn: true,
      code: true,
    },
  },
  campus: {
    select: {
      id: true,
      jwId: true,
      nameCn: true,
      nameEn: true,
      code: true,
    },
  },
  teachers: {
    select: {
      id: true,
      personId: true,
      teacherId: true,
      code: true,
      nameCn: true,
      nameEn: true,
    },
  },
} satisfies Prisma.SectionSelect;

/** Lightweight section include for list/match scenarios. */
export const sectionCompactInclude = {
  course: {
    include: {
      educationLevel: true,
      category: true,
      classify: true,
      classType: true,
      gradation: true,
      type: true,
    },
  },
  semester: true,
  campus: true,
  openDepartment: true,
  teachers: true,
} satisfies Prisma.SectionInclude;

/** Common include object for sections. */
export const sectionInclude = {
  course: {
    include: {
      educationLevel: true,
      category: true,
      classify: true,
      classType: true,
      gradation: true,
      type: true,
    },
  },
  semester: true,
  campus: true,
  openDepartment: true,
  examMode: true,
  teachLanguage: true,
  teachers: true,
  adminClasses: true,
} satisfies Prisma.SectionInclude;

/** Common include object for courses. */
export const courseInclude = {
  educationLevel: true,
  category: true,
  classify: true,
  classType: true,
  gradation: true,
  type: true,
} satisfies Prisma.CourseInclude;

export const courseDetailInclude = {
  ...courseInclude,
  sections: {
    include: {
      semester: true,
      campus: true,
      teachers: true,
    },
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
  },
} satisfies Prisma.CourseInclude;

/** Lightweight include for teacher list pages (no sections data, only count). */
export const teacherListInclude = {
  department: true,
  teacherTitle: true,
  _count: {
    select: {
      sections: true,
    },
  },
} satisfies Prisma.TeacherInclude;

/** Full include for teacher detail pages (includes all sections). */
export const teacherDetailInclude = {
  department: true,
  teacherTitle: true,
  sections: {
    include: {
      course: {
        include: courseInclude,
      },
      semester: true,
    },
    orderBy: [
      { semester: { jwId: "desc" as const } },
      { course: { nameCn: "asc" as const } },
    ],
  },
  _count: {
    select: {
      sections: true,
    },
  },
} satisfies Prisma.TeacherInclude;
