import { getDemoCatalogViewer } from "@/features/demo/server/demo-catalog";
import {
  demoHomeworkSummary,
  getDemoHomework,
  getDemoHomeworks,
  resolveDemoHomeworkSectionIds,
} from "@/features/demo/server/demo-homeworks";
import {
  HOMEWORK_LIST_DEFAULT_PAGE_SIZE,
  HOMEWORK_LIST_MAX_PAGE_SIZE,
} from "@/features/homeworks/lib/homework-list-bounds";
import type { AppLocale } from "@/i18n/config";
import {
  buildPaginatedResponse,
  notFound,
  parseRouteQuery,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import {
  homeworkAuditQuerySchema,
  homeworksQuerySchema,
  subscribedHomeworksQuerySchema,
} from "@/lib/api/schemas/content-query-schemas";
import {
  homeworkAuditListResponseSchema,
  homeworkDetailResponseSchema,
  homeworksListResponseSchema,
  subscribedHomeworksResponseSchema,
} from "@/lib/api/schemas/homeworks-response-schemas";

const pagination = {
  defaultPageSize: HOMEWORK_LIST_DEFAULT_PAGE_SIZE,
  maxPageSize: HOMEWORK_LIST_MAX_PAGE_SIZE,
};

export function getDemoSubscribedHomeworksRoute(
  request: Request,
  locale: AppLocale,
) {
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    subscribedHomeworksQuerySchema.strict(),
    "Invalid homework query",
    { pagination },
  );
  if (parsed instanceof Response) return parsed;
  const { page, pageSize } = parsed.pagination;
  const homeworks = getDemoHomeworks(locale);
  return schemaJsonResponse(
    subscribedHomeworksResponseSchema,
    buildPaginatedResponse(
      homeworks.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      homeworks.length,
    ),
  );
}

export function getDemoHomeworksRoute(request: Request, locale: AppLocale) {
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    homeworksQuerySchema.strict(),
    "Invalid homework query",
    { pagination },
  );
  if (parsed instanceof Response) return parsed;
  const ids = resolveDemoHomeworkSectionIds(parsed.query);
  if (!ids) return notFound("Section not found");
  const { page, pageSize } = parsed.pagination;
  const homeworks = getDemoHomeworks(locale).filter((homework) =>
    ids.includes(homework.sectionId),
  );
  return schemaJsonResponse(homeworksListResponseSchema, {
    ...buildPaginatedResponse(
      homeworks
        .slice((page - 1) * pageSize, page * pageSize)
        .map(demoHomeworkSummary),
      page,
      pageSize,
      homeworks.length,
    ),
    meta: { viewer: getDemoCatalogViewer() },
  });
}

export function getDemoHomeworkDetailRoute(
  request: Request,
  id: string,
  locale: AppLocale,
) {
  if (new URL(request.url).search) return notFound("Homework not found");
  const homework = getDemoHomework(id, locale);
  return homework
    ? schemaJsonResponse(homeworkDetailResponseSchema, {
        homework,
        auditLogs: [],
      })
    : notFound("Homework not found");
}

export function getDemoHomeworkAuditRoute(request: Request) {
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    homeworkAuditQuerySchema.strict(),
    "Invalid homework query",
  );
  if (query instanceof Response) return query;
  return resolveDemoHomeworkSectionIds(query)
    ? schemaJsonResponse(homeworkAuditListResponseSchema, { auditLogs: [] })
    : notFound("Section not found");
}
