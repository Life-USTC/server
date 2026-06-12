import {
  badRequest,
  parseInteger,
  parseRouteJsonBody,
  parseRouteQuery,
} from "@/lib/api/helpers";
import {
  matchSectionCodesRequestSchema,
  sectionsQuerySchema,
} from "@/lib/api/schemas/request-schemas";

export function parseSectionsRouteQuery(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  return parseRouteQuery(
    searchParams,
    sectionsQuerySchema,
    "Invalid section query",
    { logErrors: true },
  );
}

export async function parseSectionMatchCodesRequest(request: Request) {
  const parsedBody = await parseRouteJsonBody(
    request,
    matchSectionCodesRequestSchema,
    "Invalid match-codes payload",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const { codes, semesterId } = parsedBody;
  const parsedSemesterId = semesterId ? parseInteger(String(semesterId)) : null;

  if (semesterId && parsedSemesterId === null) {
    return badRequest("semesterId must be a valid number");
  }

  return { codes, semesterId: parsedSemesterId ?? undefined };
}
