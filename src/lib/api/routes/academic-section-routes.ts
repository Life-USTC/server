import { handleRouteError, parseIntegerList } from "@/lib/api/helpers";
import { parseScheduleDateParam } from "@/lib/api/routes/academic-route-helpers";
import {
  getSectionDetailAction,
  getSectionScheduleGroupsAction,
  getSectionSchedulesAction,
  listSectionsAction,
  matchSectionCodesAction,
} from "@/lib/api/routes/academic-section-actions";
import { withParsedSectionJwId } from "@/lib/api/routes/academic-section-jw-route";
import {
  parseSectionMatchCodesRequest,
  parseSectionSchedulesRouteQuery,
  parseSectionsRouteQuery,
} from "@/lib/api/routes/academic-section-route-request";
import { parsePositiveIntegerQuery } from "@/lib/api/routes/query-value-parsing";
import { getRequestLocale } from "@/lib/api/routes/request-locale";

export async function getSectionsRoute(request: Request) {
  const parsed = parseSectionsRouteQuery(request);
  if (parsed instanceof Response) {
    return parsed;
  }

  const { query: parsedQuery, pagination } = parsed;
  try {
    const locale = getRequestLocale(request);
    return await listSectionsAction(
      {
        ...parsedQuery,
        ids: parseIntegerList(parsedQuery.ids),
        jwIds: parseIntegerList(parsedQuery.jwIds),
      },
      pagination,
      locale,
    );
  } catch (error) {
    return handleRouteError("Failed to fetch sections", error);
  }
}

export async function getSectionDetailRoute(
  request: Request,
  params: { jwId: string },
) {
  const locale = getRequestLocale(request);
  return withParsedSectionJwId(
    params,
    "Failed to fetch section",
    (parsedJwId) => getSectionDetailAction(parsedJwId, locale),
  );
}

export async function getSectionSchedulesRoute(
  request: Request,
  params: { jwId: string },
) {
  const locale = getRequestLocale(request);
  const parsedQuery = parseSectionSchedulesRouteQuery(request);
  if (parsedQuery instanceof Response) return parsedQuery;

  const dateFrom = parseScheduleDateParam("dateFrom", parsedQuery.dateFrom);
  if (dateFrom instanceof Response) return dateFrom;
  const dateTo = parseScheduleDateParam("dateTo", parsedQuery.dateTo);
  if (dateTo instanceof Response) return dateTo;
  const limit = parsePositiveIntegerQuery("limit", parsedQuery.limit, {
    max: 200,
    message: "Invalid section schedule query",
  });
  if (limit instanceof Response) return limit;

  return withParsedSectionJwId(
    params,
    "Failed to fetch section schedules",
    (parsedJwId) =>
      getSectionSchedulesAction(parsedJwId, locale, {
        dateFrom,
        dateTo,
        limit,
      }),
  );
}

export async function getSectionScheduleGroupsRoute(
  request: Request,
  params: { jwId: string },
) {
  const locale = getRequestLocale(request);
  return withParsedSectionJwId(
    params,
    "Failed to fetch schedule groups",
    (parsedJwId) => getSectionScheduleGroupsAction(parsedJwId, locale),
  );
}

export async function postSectionMatchCodesRoute(request: Request) {
  try {
    const parsed = await parseSectionMatchCodesRequest(request);
    if (parsed instanceof Response) {
      return parsed;
    }

    return await matchSectionCodesAction(
      parsed.codes,
      getRequestLocale(request),
      parsed.semesterId,
    );
  } catch (error) {
    return handleRouteError("Failed to match section codes", error);
  }
}
