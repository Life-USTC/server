import type { AppLocale } from "@/i18n/config";
import { jsonResponse } from "@/lib/api/helpers";
import { cachedPublicRuntimeData } from "@/lib/public-runtime-cache";

const SECTION_LIST_API_CACHE_TTL_MS = 60_000;

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
  const result = await cachedPublicRuntimeData(
    `api:sections:${JSON.stringify({ locale, parsedQuery, pagination })}`,
    SECTION_LIST_API_CACHE_TTL_MS,
    () => listUncachedSectionsAction(parsedQuery, pagination, locale),
  );
  return jsonResponse(result, {
    headers: cacheHeaders,
  });
}

async function listUncachedSectionsAction(
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
