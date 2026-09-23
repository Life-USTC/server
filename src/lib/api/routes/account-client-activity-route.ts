import {
  InvalidAccountActivityCursorError,
  listOAuthClientActivityPage,
} from "@/features/settings/server/account-activity";
import {
  badRequest,
  getRequestSearchParams,
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
  unauthorized,
} from "@/lib/api/helpers";
import { accountClientActivityQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiPrincipal } from "@/lib/auth/api-auth";

export async function getAccountClientActivityRoute(request: Request) {
  try {
    const principal = await resolveApiPrincipal(request, {
      bearerScope: { feature: "account.client-activity", action: "read" },
    });
    if (!principal || principal.kind !== "oauth" || !principal.grantId) {
      return unauthorized();
    }

    const query = parseRouteSearchParams(
      getRequestSearchParams(request),
      accountClientActivityQuerySchema,
      "Invalid account activity query",
    );
    if (query instanceof Response) return query;

    const page = await listOAuthClientActivityPage(
      {
        userId: principal.userId,
        clientId: principal.clientId,
        grantId: principal.grantId,
      },
      query,
    );
    return jsonResponse(page, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof InvalidAccountActivityCursorError) {
      return badRequest("Invalid account activity cursor");
    }
    return handleRouteError("Failed to fetch account client activity", error);
  }
}
