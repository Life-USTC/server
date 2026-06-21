import type { IntegerFilter } from "@/lib/query-filter-helpers";

export type CourseListFilters = {
  search?: string | null;
  educationLevelId?: IntegerFilter;
  categoryId?: IntegerFilter;
  classTypeId?: IntegerFilter;
};

export type SectionListFilters = {
  courseId?: IntegerFilter;
  courseJwId?: IntegerFilter;
  semesterId?: IntegerFilter;
  semesterJwId?: IntegerFilter;
  campusId?: IntegerFilter;
  departmentId?: IntegerFilter;
  teacherId?: IntegerFilter;
  teacherCode?: string | null;
  ids?: number[] | string | null;
  jwIds?: number[] | string | null;
  search?: string | null;
};
