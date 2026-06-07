import type { NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { getBusTimetableData } from "@/features/bus/lib/bus-service";
import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { busQuerySchema } from "@/lib/api/schemas/request-schemas";
import { busQueryResponseSchema } from "@/lib/api/schemas/response-schemas";
import { resolveApiUserId } from "@/lib/auth/helpers";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Public shuttle-bus query API.
 * @params busQuerySchema
 * @response busQueryResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    busQuerySchema,
    "Invalid bus query",
    { logErrors: true },
  );

  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  const locale = await getLocale();
  const userId = await resolveApiUserId(request);

  try {
    const result = await getBusTimetableData({
      locale: locale === "en-us" ? "en-us" : "zh-cn",
      versionKey: parsedQuery.versionKey ?? null,
      userId,
    });

    if (!result) {
      return notFound("Bus schedule is not available");
    }

    const validated = busQueryResponseSchema.parse(result);
    return jsonResponse(validated);
  } catch (error) {
    return handleRouteError("Failed to query shuttle bus schedules", error);
  }
}
export const GET = observedApiRoute(getRoute);
