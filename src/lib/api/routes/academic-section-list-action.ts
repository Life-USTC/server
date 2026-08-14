import type { AppLocale } from "@/i18n/config";
import { jsonResponse } from "@/lib/api/helpers";

export async function listSectionsAction(
  parsedQuery: {
    campusId?: number | string;
    courseId?: number | string;
    courseJwId?: number | string;
    departmentId?: number | string;
    ids?: readonly number[];
    jwIds?: readonly number[];
    search?: string;
    semesterId?: number | string;
    semesterJwId?: number | string;
    teacherCode?: string;
    teacherId?: number | string;
  },
  pagination: {
    page: number;
    pageSize: number;
  },
  locale: AppLocale,
  cacheHeaders: HeadersInit,
) {
  const result = await listSectionsActionData(parsedQuery, pagination, locale);
  return jsonResponse(result, {
    headers: cacheHeaders,
  });
}

async function listSectionsActionData(
  parsedQuery: {
    campusId?: number | string;
    courseId?: number | string;
    courseJwId?: number | string;
    departmentId?: number | string;
    ids?: readonly number[];
    jwIds?: readonly number[];
    search?: string;
    semesterId?: number | string;
    semesterJwId?: number | string;
    teacherCode?: string;
    teacherId?: number | string;
  },
  pagination: {
    page: number;
    pageSize: number;
  },
  locale: AppLocale,
) {
  const { listSectionSummaries } = await import(
    "@/features/catalog/server/course-section-queries"
  );
  return listSectionSummaries({
    filters: {
      ...parsedQuery,
      ids: parsedQuery.ids ? Array.from(parsedQuery.ids) : undefined,
      jwIds: parsedQuery.jwIds ? Array.from(parsedQuery.jwIds) : undefined,
    },
    locale,
    pagination,
  });
}
