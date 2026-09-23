import {
  badRequest,
  invalidParamResponse,
  parseInteger,
  parseRouteInput,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  jwIdPathParamsSchema,
  sectionsCalendarQuerySchema,
  userCalendarPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";

export const MAX_MULTI_SECTION_CALENDAR_IDS = 50;

export function parseSectionsCalendarIds(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    sectionsCalendarQuerySchema,
    "sectionIds parameter is required",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  const rawSectionIds = parsedQuery.sectionIds.split(",");
  const parsedSectionIds: number[] = [];
  for (const value of rawSectionIds) {
    const sectionId = parseInteger(value);
    if (sectionId === null || sectionId <= 0) {
      return badRequest("Invalid sectionIds parameter");
    }
    parsedSectionIds.push(sectionId);
  }

  const sectionIds = Array.from(new Set(parsedSectionIds)).sort(
    (left, right) => left - right,
  );
  if (sectionIds.length > MAX_MULTI_SECTION_CALENDAR_IDS) {
    return badRequest(
      `sectionIds must contain at most ${MAX_MULTI_SECTION_CALENDAR_IDS} unique IDs`,
    );
  }

  return sectionIds;
}

export function canonicalSectionsCalendarUrl(
  request: Request,
  sectionIds: readonly number[],
) {
  const url = new URL(request.url);
  const canonicalIds = sectionIds.join(",");
  if (
    url.searchParams.size === 1 &&
    url.searchParams.get("sectionIds") === canonicalIds
  ) {
    return null;
  }

  url.search = "";
  url.searchParams.set("sectionIds", canonicalIds);
  return url;
}

export function parseSectionCalendarJwId(params: { jwId: string }) {
  const parsedParams = parseRouteInput(
    params,
    jwIdPathParamsSchema,
    "Invalid section JW ID",
  );
  if (parsedParams instanceof Response) {
    return invalidParamResponse("section JW ID");
  }

  const sectionJwId = parseInteger(parsedParams.jwId);

  if (sectionJwId === null) {
    return invalidParamResponse("section JW ID");
  }

  return sectionJwId;
}

export function parseUserCalendarRawUserId(params: { userId: string }) {
  const parsedParams = parseRouteInput(
    params,
    userCalendarPathParamsSchema,
    "Invalid user ID",
  );
  if (parsedParams instanceof Response) {
    return invalidParamResponse("user ID");
  }

  return parsedParams.userId;
}
