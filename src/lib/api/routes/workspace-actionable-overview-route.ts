import { getActionableOverview } from "@/features/workspace/server/actionable-overview-read-model";
import {
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { actionableOverviewQuerySchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getActionableOverviewRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.overview", action: "read" },
  });
  if (auth instanceof Response) return auth;
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    actionableOverviewQuerySchema,
    "Invalid overview query",
  );
  if (query instanceof Response) return query;
  try {
    return jsonResponse(
      await getActionableOverview(auth.userId, {
        ...query,
        locale: query.locale ?? getRequestLocale(request),
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleRouteError("Failed to fetch actionable overview", error);
  }
}
