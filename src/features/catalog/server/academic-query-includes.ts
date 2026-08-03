import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import type { Prisma } from "@/generated/prisma/client";

export const departmentSummarySelect = {
  id: true,
  code: true,
  isCollege: true,
  nameCn: true,
  nameEn: true,
  namePrimary: true,
  nameSecondary: true,
};

export const teacherTitleSummarySelect = {
  id: true,
  jwId: true,
  code: true,
  enabled: true,
  nameCn: true,
  nameEn: true,
  namePrimary: true,
  nameSecondary: true,
};

const teacherPublicScalarSelect = {
  id: true,
  personId: true,
  teacherId: true,
  code: true,
  ...localizedNameSelect,
  email: true,
  telephone: true,
  mobile: true,
  address: true,
  departmentId: true,
  teacherTitleId: true,
} satisfies Prisma.TeacherSelect;

/** Narrow teacher payload for schedule entries: names and department only. */
export const scheduleTeacherSelect = {
  id: true,
  personId: true,
  teacherId: true,
  code: true,
  nameCn: true,
  nameEn: true,
  namePrimary: true,
  nameSecondary: true,
  department: {
    select: departmentSummarySelect,
  },
};

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
};

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
      ...localizedNameSelect,
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
      ...localizedNameSelect,
      code: true,
    },
  },
  teachers: {
    select: {
      id: true,
      personId: true,
      teacherId: true,
      code: true,
      ...localizedNameSelect,
    },
  },
};

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
      teachers: true,
    },
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
  },
} satisfies Prisma.CourseInclude;

/** @deprecated Use teacherPublicListSelect with select instead of include. */
export const teacherListInclude = teacherPublicListSelect;

/** @deprecated Use teacherPublicDetailSelect with select instead of include. */
export const teacherDetailInclude = teacherPublicDetailSelect;
