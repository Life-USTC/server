import { jsonResponse } from "@/lib/api/helpers";
import { PUBLIC_CATALOG_CACHE_CONTROL } from "@/lib/public-cache-control";
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
) {
  const result = await cachedPublicRuntimeData(
    `api:sections:${JSON.stringify({ parsedQuery, pagination })}`,
    SECTION_LIST_API_CACHE_TTL_MS,
    () => listUncachedSectionsAction(parsedQuery, pagination),
  );
  return jsonResponse(result, {
    headers: { "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL },
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
) {
  const { buildSectionListQuery } = await import(
    "@/lib/course-section-queries"
  );
  const { where, orderBy } = buildSectionListQuery({
    ...parsedQuery,
    ids: parsedQuery.ids ? Array.from(parsedQuery.ids) : undefined,
    jwIds: parsedQuery.jwIds ? Array.from(parsedQuery.jwIds) : undefined,
  });
  const { paginatedSectionSummaryQuery } = await import("@/lib/query-helpers");
  const result = await paginatedSectionSummaryQuery(
    pagination.page,
    pagination.pageSize,
    where,
    orderBy,
  );
  return result;
}
