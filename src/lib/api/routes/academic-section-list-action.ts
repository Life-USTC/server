import type { AppLocale } from "@/i18n/config";
import { schemaJsonResponse } from "@/lib/api/responses";
import { paginatedSectionResponseSchema } from "@/lib/api/schemas/response-schemas";

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
  return schemaJsonResponse(paginatedSectionResponseSchema, result, {
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
