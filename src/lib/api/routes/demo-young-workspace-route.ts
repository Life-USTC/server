import { getDemoYoungSubscriptionFacts } from "@/features/demo/server/demo-young";
import {
  getDemoYoungEventSubscriptions,
  getDemoYoungNotifications,
  getDemoYoungOrganizerSubscriptions,
} from "@/features/demo/server/demo-young-workspace";
import type { AppLocale } from "@/i18n/config";
import {
  errorResponse,
  parseRouteSearchParams,
  schemaJsonResponse,
} from "@/lib/api/helpers";
import {
  youngEventSubscriptionListSchema,
  youngEventSubscriptionStateSchema,
  youngNotificationListSchema,
  youngOrganizerSubscriptionListSchema,
  youngOrganizerSubscriptionStateSchema,
  youngWorkspaceQuerySchema,
} from "@/lib/api/schemas/young-workspace-schemas";
export function getDemoYoungWorkspaceRoute(
  request: Request,
  kind: "events" | "organizers" | "notifications",
  locale: AppLocale,
) {
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    youngWorkspaceQuerySchema,
    "Invalid query",
  );
  if (query instanceof Response) return query;
  if (kind === "events")
    return schemaJsonResponse(
      youngEventSubscriptionListSchema,
      getDemoYoungEventSubscriptions(locale, query),
    );
  if (kind === "organizers")
    return schemaJsonResponse(
      youngOrganizerSubscriptionListSchema,
      getDemoYoungOrganizerSubscriptions(locale, query),
    );
  return schemaJsonResponse(
    youngNotificationListSchema,
    getDemoYoungNotifications(locale, query),
  );
}
export function getDemoYoungSubscriptionStateRoute(
  kind: "events" | "organizers",
  id: string,
) {
  const facts = getDemoYoungSubscriptionFacts(kind, id);
  if (!facts) return errorResponse("Demo subscription target not found", 404);
  return kind === "events"
    ? schemaJsonResponse(youngEventSubscriptionStateSchema, {
        youngId: id,
        ...facts,
      })
    : schemaJsonResponse(youngOrganizerSubscriptionStateSchema, {
        organizerId: id,
        ...facts,
      });
}
