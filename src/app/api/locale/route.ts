import type { NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/i18n/config";
import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { localeUpdateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Update user locale cookie.
 * @body localeUpdateRequestSchema
 * @response successResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: NextRequest) {
  try {
    const parsedBody = await parseRouteJsonBody(
      request,
      localeUpdateRequestSchema,
      "Invalid locale",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const locale = parsedBody.locale;

    const response = jsonResponse({ success: true });
    response.cookies.set(LOCALE_COOKIE, locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    return handleRouteError("Failed to set locale", error);
  }
}
export const POST = observedApiRoute(postRoute);
