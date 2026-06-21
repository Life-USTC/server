import { listSectionSummaries } from "@/features/catalog/server/course-section-queries";
import type { AppLocale } from "@/i18n/config";

type SearchSectionsForMcpToolInput = {
  campusId?: number;
  courseId?: number;
  courseJwId?: number;
  departmentId?: number;
  ids?: number[];
  jwIds?: number[];
  limit: number;
  locale: AppLocale;
  page: number;
  search?: string;
  semesterId?: number;
  semesterJwId?: number;
  teacherCode?: string;
  teacherId?: number;
};

export async function searchSectionsForMcpTool({
  campusId,
  courseId,
  courseJwId,
  departmentId,
  ids,
  jwIds,
  limit,
  locale,
  page,
  search,
  semesterId,
  semesterJwId,
  teacherCode,
  teacherId,
}: SearchSectionsForMcpToolInput) {
  return listSectionSummaries({
    filters: {
      campusId,
      courseId,
      courseJwId,
      departmentId,
      ids,
      jwIds,
      search,
      semesterId,
      semesterJwId,
      teacherCode,
      teacherId,
    },
    locale,
    pagination: { page, pageSize: limit },
  });
}
