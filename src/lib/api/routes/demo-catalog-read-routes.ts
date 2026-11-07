import {
  buildDemoCatalogDescription,
  getDemoCatalogSection,
} from "@/features/demo/server/demo-catalog";
import { resolveDemoCatalogTarget } from "@/features/demo/server/demo-catalog-community";
import {
  getDemoCommunityComment,
  getDemoCommunityPage,
  getDemoCommunityReplies,
} from "@/features/demo/server/demo-community";
import type { AppLocale } from "@/i18n/config";
import {
  badRequest,
  notFound,
  parseRouteInput,
  parseRouteQuery,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { sectionDetailSchema } from "@/lib/api/schemas/academic-section-detail-response-schemas";
import {
  commentRepliesResponseSchema,
  commentsListResponseSchema,
  commentThreadResponseSchema,
} from "@/lib/api/schemas/comments-response-schemas";
import {
  commentRepliesQuerySchema,
  commentsQuerySchema,
  descriptionsQuerySchema,
  resourceIdPathParamsSchema,
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
  return schemaJsonResponse(
    commentsListResponseSchema,
    getDemoCommunityPage(
      target,
      locale,
      parsed.pagination.page,
      parsed.pagination.pageSize,
    ),
  );
}

export function getDemoCommentRoute(id: string, locale: AppLocale) {
  const params = parseRouteInput(
    { id },
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (params instanceof Response) return params;
  const result = getDemoCommunityComment(params.id, locale);
  return result
    ? schemaJsonResponse(commentThreadResponseSchema, result)
    : notFound();
}

export function getDemoCommentRepliesRoute(
  request: Request,
  id: string,
  locale: AppLocale,
) {
  const params = parseRouteInput(
    { id },
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (params instanceof Response) return params;
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    commentRepliesQuerySchema,
    "Invalid reply pagination",
    { pagination: { defaultPageSize: 20, maxPageSize: 20 } },
  );
  if (parsed instanceof Response) return parsed;
  const result = getDemoCommunityReplies(
    params.id,
    locale,
    parsed.query.cursor,
    parsed.pagination.pageSize,
  );
  if (!result.ok)
    return result.error === "not_found"
      ? notFound()
      : badRequest("Invalid reply cursor");
  return schemaJsonResponse(commentRepliesResponseSchema, result);
}
