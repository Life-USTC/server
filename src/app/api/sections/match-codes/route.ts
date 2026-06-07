import type { NextRequest } from "next/server";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  parseInteger,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { matchSectionCodesRequestSchema } from "@/lib/api/schemas/request-schemas";
import { findSectionCodeMatches } from "@/lib/course-section-queries";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Match section codes in one semester.
 * @body matchSectionCodesRequestSchema
 * @response matchSectionCodesResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: NextRequest) {
  try {
    const parsedBody = await parseRouteJsonBody(
      request,
      matchSectionCodesRequestSchema,
      "Invalid match-codes payload",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const { codes, semesterId } = parsedBody;

    const parsedSemesterId = semesterId
      ? parseInteger(String(semesterId))
      : null;

    if (semesterId && parsedSemesterId === null) {
      return badRequest("semesterId must be a valid number");
    }

    const matches = await findSectionCodeMatches(
      codes,
      "zh-cn",
      parsedSemesterId ?? undefined,
    );

    if (!matches) {
      return handleRouteError(
        "No semester found",
        new Error("No semester"),
        404,
      );
    }

    return jsonResponse({
      semester: matches.semester,
      matchedCodes: matches.matchedCodes,
      unmatchedCodes: matches.unmatchedCodes,
      sections: matches.sections,
      total: matches.total,
    });
  } catch (error) {
    return handleRouteError("Failed to match section codes", error);
  }
}
export const POST = observedApiRoute(postRoute);
