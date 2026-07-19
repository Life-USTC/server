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
import {
  getRequestLocale,
  resolvePublicCatalogLocale,
} from "@/lib/api/routes/request-locale";

export async function getSectionsRoute(request: Request) {
  const localeResolution = resolvePublicCatalogLocale(request);
  if (localeResolution instanceof Response) {
    return localeResolution;
  }

  const parsed = parseSectionsRouteQuery(request);
  if (parsed instanceof Response) {
    return parsed;
  }

  const { query: parsedQuery, pagination } = parsed;
  const { locale: _locale, ...filters } = parsedQuery;
  try {
    return await listSectionsAction(
      {
        ...filters,
        ids: parseIntegerList(filters.ids),
        jwIds: parseIntegerList(filters.jwIds),
      },
      pagination,
      localeResolution.locale,
      localeResolution.cacheHeaders,
    );
  } catch (error) {
    return handleRouteError("Failed to fetch sections", error);
  }
}

export async function getSectionDetailRoute(
  request: Request,
  params: { jwId: string },
) {
  const localeResolution = resolvePublicCatalogLocale(request);
  if (localeResolution instanceof Response) {
    return localeResolution;
  }

  return withParsedSectionJwId(
    params,
    "Failed to fetch section",
    (parsedJwId) =>
      getSectionDetailAction(
        parsedJwId,
        localeResolution.locale,
        localeResolution.cacheHeaders,
      ),
  );
}

export async function getSectionSchedulesRoute(
  request: Request,
  params: { jwId: string },
) {
  const localeResolution = resolvePublicCatalogLocale(request);
  if (localeResolution instanceof Response) {
    return localeResolution;
  }

  const parsedQuery = parseSectionSchedulesRouteQuery(request);
  if (parsedQuery instanceof Response) return parsedQuery;

  return withParsedSectionJwId(
    params,
    "Failed to fetch section schedules",
    (parsedJwId) =>
      getSectionSchedulesAction(
        parsedJwId,
        localeResolution.locale,
        localeResolution.cacheHeaders,
        {
          dateFrom: parsedQuery.dateFrom,
          dateTo: parsedQuery.dateTo,
          limit: parsedQuery.limit,
        },
      ),
  );
}

export async function getSectionScheduleGroupsRoute(
  request: Request,
  params: { jwId: string },
) {
  const localeResolution = resolvePublicCatalogLocale(request);
  if (localeResolution instanceof Response) {
    return localeResolution;
  }

  return withParsedSectionJwId(
    params,
    "Failed to fetch schedule groups",
    (parsedJwId) =>
      getSectionScheduleGroupsAction(
        parsedJwId,
        localeResolution.locale,
        localeResolution.cacheHeaders,
      ),
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
