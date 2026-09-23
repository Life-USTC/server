import type { Prisma } from "@/generated/prisma/client";

const persistedLocalizedNameSelect = {
  nameCn: true,
  nameEn: true,
} as const;

export const departmentSummarySelect = {
  id: true,
  code: true,
  isCollege: true,
  ...persistedLocalizedNameSelect,
} as const satisfies Prisma.DepartmentSelect;

export const teacherTitleSummarySelect = {
  id: true,
  jwId: true,
  code: true,
  enabled: true,
  ...persistedLocalizedNameSelect,
} as const satisfies Prisma.TeacherTitleSelect;

const teacherPublicScalarSelect = {
  id: true,
  jwId: true,
  personId: true,
  code: true,
  ...persistedLocalizedNameSelect,
  email: true,
  telephone: true,
  mobile: true,
  address: true,
  departmentId: true,
  teacherTitleId: true,
} satisfies Prisma.TeacherSelect;

/** Safe teacher identity for embedding in public course/section summaries. */
export const teacherPublicIdentitySelect = {
  id: true,
  jwId: true,
  personId: true,
  code: true,
  ...persistedLocalizedNameSelect,
} satisfies Prisma.TeacherSelect;

/** Public teacher reference with the catalog context used by section detail. */
export const teacherPublicReferenceSelect = {
  ...teacherPublicIdentitySelect,
  department: {
    select: departmentSummarySelect,
  },
  teacherTitle: {
    select: teacherTitleSummarySelect,
  },
} satisfies Prisma.TeacherSelect;

export const PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT = 20;

export const teacherAssignmentPublicSelect = {
  id: true,
  teacherId: true,
  sectionId: true,
  role: true,
  period: true,
  weekIndices: true,
  weekIndicesMsg: true,
  teacherLessonTypeId: true,
  teacherTitleId: true,
  teacherLessonType: {
    select: {
      id: true,
      jwId: true,
      nameCn: true,
      nameEn: true,
      code: true,
      role: true,
      enabled: true,
    },
  },
  teacherTitle: {
    select: teacherTitleSummarySelect,
  },
} satisfies Prisma.TeacherAssignmentSelect;

/** Narrow teacher payload for schedule entries: names and department only. */
export const scheduleTeacherSelect = {
  id: true,
  jwId: true,
  personId: true,
  code: true,
  ...persistedLocalizedNameSelect,
  department: {
    select: departmentSummarySelect,
  },
} as const satisfies Prisma.TeacherSelect;

/** Schedule teacher payload with title and section count for subscribed/workspace surfaces. */
export const scheduleTeacherContextSelect = {
  ...scheduleTeacherSelect,
  teacherTitle: {
    select: teacherTitleSummarySelect,
  },
  _count: {
    select: {
      sections: { where: { retiredAt: null } },
    },
  },
} as const satisfies Prisma.TeacherSelect;

/** Public catalog teacher list/detail fields (no postcode, qq, wechat, or age). */
export const teacherPublicListSelect = {
  ...teacherPublicScalarSelect,
  department: {
    select: departmentSummarySelect,
  },
  teacherTitle: {
    select: teacherTitleSummarySelect,
  },
  _count: {
    select: {
      sections: { where: { retiredAt: null } },
    },
  },
} satisfies Prisma.TeacherSelect;

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
      ...persistedLocalizedNameSelect,
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
      ...persistedLocalizedNameSelect,
      code: true,
    },
  },
  teachers: {
    select: teacherPublicIdentitySelect,
  },
} as const satisfies Prisma.SectionSelect;

/** Stable public section identity and course/semester context for child records. */
export const sectionPublicContextSelect = {
  id: true,
  jwId: true,
  code: true,
  course: {
    select: {
      jwId: true,
      code: true,
      ...persistedLocalizedNameSelect,
    },
  },
  semester: {
    select: {
      jwId: true,
      code: true,
      nameCn: true,
    },
  },
} as const satisfies Prisma.SectionSelect;

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
  teachers: { select: teacherPublicIdentitySelect },
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
  teachers: { select: teacherPublicIdentitySelect },
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

/** Public catalog teacher detail (no postcode, qq, wechat, or age). */
export const teacherPublicDetailSelect = {
  ...teacherPublicScalarSelect,
  department: {
    select: departmentSummarySelect,
  },
  teacherTitle: {
    select: teacherTitleSummarySelect,
  },
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
    take: PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
  },
  _count: {
    select: {
      sections: true,
    },
  },
} satisfies Prisma.TeacherSelect;

/** Public catalog Section shape without unbounded child collections. */
export const sectionCatalogInclude = {
  course: {
    include: courseInclude,
  },
  semester: true,
  campus: true,
  openDepartment: true,
  examMode: true,
  teachLanguage: true,
} satisfies Prisma.SectionInclude;

export const courseDetailInclude = {
  ...courseInclude,
  sections: {
    include: {
      semester: true,
      campus: true,
      teachers: { select: teacherPublicIdentitySelect },
    },
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
    take: PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
  },
  _count: { select: { sections: true } },
} satisfies Prisma.CourseInclude;

/** @deprecated Use teacherPublicListSelect with select instead of include. */
export const teacherListInclude = teacherPublicListSelect;

/** @deprecated Use teacherPublicDetailSelect with select instead of include. */
export const teacherDetailInclude = teacherPublicDetailSelect;
