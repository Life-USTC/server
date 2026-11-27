import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";

import type {
  loadCourseDetailPage,
  loadTeacherDetailPage,
} from "../server/catalog-detail-page-server";

export type CoursePage = Awaited<ReturnType<typeof loadCourseDetailPage>>;
export type TeacherPage = Awaited<ReturnType<typeof loadTeacherDetailPage>>;

export type CourseDetailCopy = CoursePage["copy"];
export type TeacherDetailCopy = TeacherPage["copy"];
export type CourseDetailCourse = CoursePage["course"];
export type TeacherDetailTeacher = TeacherPage["teacher"];

export type CourseDetailSection = {
  campus?: CatalogNamed | null;
  code: string;
  jwId: number | string;
  limitCount?: number | null;
  semester?: { nameCn?: string | null } | null;
  stdCount?: number | null;
  teachers: CatalogNamed[];
};

export type TeacherDetailSection = {
  teachers?: CatalogNamed[];
  code: string;
  course: CatalogNamed;
  credits?: number | string | null;
  jwId: number | string;
  semester?: { nameCn?: string | null } | null;
};
