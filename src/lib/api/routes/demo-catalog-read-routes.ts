import {
  buildDemoCatalogDescription,
  getDemoCatalogSection,
  getDemoCatalogViewer,
} from "@/features/demo/server/demo-catalog";
import { resolveDemoCatalogTarget } from "@/features/demo/server/demo-catalog-community";
import type { AppLocale } from "@/i18n/config";
import {
  buildPaginatedResponse,
  notFound,
  parseRouteQuery,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { sectionDetailSchema } from "@/lib/api/schemas/academic-section-detail-response-schemas";
import { commentsListResponseSchema } from "@/lib/api/schemas/comments-response-schemas";
import {
  commentsQuerySchema,
  descriptionsQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import { descriptionsResponseSchema } from "@/lib/api/schemas/response-schemas";
import { parseSectionDetailRouteQuery } from "./academic-section-route-request";

export function getDemoSectionDetailRoute(
  request: Request,
  jwId: string,
  locale: AppLocale,
) {
  const query = parseSectionDetailRouteQuery(request);
  if (query instanceof Response) return query;
  const section = getDemoCatalogSection(Number(jwId), query.locale ?? locale, {
    includeExams: query.includeExams,
    includeSchedules: query.includeSchedules,
    includeTeacherDepartments: query.includeTeacherDepartments,
  });
  return section
    ? schemaJsonResponse(sectionDetailSchema, section)
    : notFound("Section not found");
}

export function getDemoDescriptionRoute(request: Request, locale: AppLocale) {
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    descriptionsQuerySchema.strict(),
    "Invalid target",
  );
  if (query instanceof Response) return query;
  const target = resolveDemoCatalogTarget(query, locale);
  const payload = target?.targetId
    ? buildDemoCatalogDescription(target.type, target.targetId, locale)
    : null;
  return payload
    ? schemaJsonResponse(descriptionsResponseSchema, payload)
    : notFound("Target not found");
}

export function getDemoCommentsRoute(request: Request, locale: AppLocale) {
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    commentsQuerySchema,
    "Invalid target",
    { pagination: { defaultPageSize: 20, maxPageSize: 100 } },
  );
  if (parsed instanceof Response) return parsed;
  const target = resolveDemoCatalogTarget(parsed.query, locale);
  if (!target) return notFound("Target not found");
  return schemaJsonResponse(commentsListResponseSchema, {
    ...buildPaginatedResponse(
      [],
      parsed.pagination.page,
      parsed.pagination.pageSize,
      0,
    ),
    meta: { hiddenCount: 0, viewer: getDemoCatalogViewer(), target },
  });
}
