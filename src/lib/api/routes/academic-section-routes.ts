import { handleRouteError, parseIntegerList } from "@/lib/api/helpers";
import { getSectionDetailAction } from "@/lib/api/routes/academic-section-detail-action";
import { withParsedSectionJwId } from "@/lib/api/routes/academic-section-jw-route";
import { listSectionsAction } from "@/lib/api/routes/academic-section-list-action";
import { matchSectionCodesAction } from "@/lib/api/routes/academic-section-match-action";
import {
  parseSectionMatchCodesRequest,
  parseSectionSchedulesRouteQuery,
  parseSectionsRouteQuery,
} from "@/lib/api/routes/academic-section-route-request";
import {
  getSectionScheduleGroupsAction,
  getSectionSchedulesAction,
} from "@/lib/api/routes/academic-section-schedule-actions";
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

  return withParsedSectionJwId(
    params,
    "Failed to fetch section schedules",
    (parsedJwId) =>
      getSectionSchedulesAction(parsedJwId, locale, {
        dateFrom: parsedQuery.dateFrom,
        dateTo: parsedQuery.dateTo,
        limit: parsedQuery.limit,
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
