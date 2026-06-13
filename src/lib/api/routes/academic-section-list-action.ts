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
  return jsonResponse(result);
}
