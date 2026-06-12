import { LOCALE_COOKIE } from "@/i18n/config";
import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { localeUpdateRequestSchema } from "@/lib/api/schemas/request-schemas";

export async function postLocaleRoute(request: Request) {
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

    return jsonResponse(
      { success: true },
      {
        headers: {
          "Set-Cookie": `${LOCALE_COOKIE}=${locale}; Max-Age=${
            60 * 60 * 24 * 365
          }; Path=/; SameSite=Lax`,
        },
      },
    );
  } catch (error) {
    return handleRouteError("Failed to set locale", error);
  }
}
