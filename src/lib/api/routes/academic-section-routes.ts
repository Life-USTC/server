import { handleRouteError, parseIntegerList } from "@/lib/api/helpers";
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
  parseSectionsRouteQuery,
} from "@/lib/api/routes/academic-section-route-request";
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

export async function getSectionSchedulesRoute(params: { jwId: string }) {
  return withParsedSectionJwId(
    params,
    "Failed to fetch section schedules",
    getSectionSchedulesAction,
  );
}

export async function getSectionScheduleGroupsRoute(params: { jwId: string }) {
  return withParsedSectionJwId(
    params,
    "Failed to fetch schedule groups",
    getSectionScheduleGroupsAction,
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
