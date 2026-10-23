import type { SectionHistoryScope } from "@/features/catalog/server/section-history-read-model";
import { handleRouteError, notFound, parseRouteQuery } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { catalogSectionHistoryQuerySchema } from "@/lib/api/schemas/request-schemas";
import { paginatedSectionHistoryResponseSchema } from "@/lib/api/schemas/response-schemas";
import {
  parseJwIdRouteParam,
  parseResourceIdRouteParam,
} from "./academic-route-helpers";
import { resolvePublicCatalogLocale } from "./request-locale";

async function getSectionHistoryRoute(
  request: Request,
  scope: SectionHistoryScope,
) {
  const locale = resolvePublicCatalogLocale(request);
  if (locale instanceof Response) return locale;
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    catalogSectionHistoryQuerySchema,
    "Invalid section history query",
    { logErrors: true },
  );
  if (parsed instanceof Response) return parsed;
  try {
    const { listSectionHistory } = await import(
      "@/features/catalog/server/section-history-read-model"
    );
    const history = await listSectionHistory({
      scope,
      locale: locale.locale,
      pagination: parsed.pagination,
    });
    if (!history)
      return notFound(
        scope.kind === "course" ? "Course not found" : "Teacher not found",
      );
    return schemaJsonResponse(paginatedSectionHistoryResponseSchema, history, {
      headers: locale.cacheHeaders,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch section history", error);
  }
}

export function getCourseSectionHistoryRoute(
  request: Request,
  params: { jwId: string },
) {
  const jwId = parseJwIdRouteParam(params, "course ID");
  return jwId instanceof Response
    ? jwId
    : getSectionHistoryRoute(request, { kind: "course", jwId });
}

export function getTeacherSectionHistoryRoute(
  request: Request,
  params: { id: string },
) {
  const id = parseResourceIdRouteParam(params, "teacher ID");
  return id instanceof Response
    ? id
    : getSectionHistoryRoute(request, { kind: "teacher", id });
}
