import {
  badRequest,
  invalidParamResponse,
  parseInteger,
  parseIntegerList,
  parseRouteInput,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  jwIdPathParamsSchema,
  sectionsCalendarQuerySchema,
  userCalendarPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";

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

  const sectionIds = parseIntegerList(parsedQuery.sectionIds);

  if (sectionIds.length === 0) {
    return badRequest("No valid section IDs provided");
  }

  return sectionIds;
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
