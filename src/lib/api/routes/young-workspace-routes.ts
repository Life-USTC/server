import {
  InvalidCalendarRangeError,
  listPersonalCalendarPage,
} from "@/features/calendar/server/personal-calendar-page";
import {
  listYoungNotifications,
  readYoungNotification,
} from "@/features/young/server/young-notification-service";
import {
  getYoungEventSubscription,
  getYoungOrganizerSubscription,
  listYoungEventSubscriptions,
  listYoungOrganizerSubscriptions,
  setYoungEventSubscription,
  setYoungOrganizerSubscription,
  YoungSubscriptionNotFoundError,
} from "@/features/young/server/young-subscription-service";
import {
  errorResponse,
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  personalCalendarQuerySchema,
  youngEventSubscriptionRequestSchema,
  youngOrganizerSubscriptionRequestSchema,
  youngWorkspaceQuerySchema,
} from "@/lib/api/schemas/young-workspace-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function getYoungWorkspaceRoute(
  request: Request,
  kind: "events" | "organizers" | "notifications",
) {
  const auth = await requireAuth(request, {
    bearerScope: {
      feature:
        kind === "notifications"
          ? "workspace.young-notification"
          : "workspace.young-subscription",
      action: "read",
    },
  });
  if (auth instanceof Response) return auth;
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    youngWorkspaceQuerySchema,
    "Invalid query",
  );
  if (query instanceof Response) return query;
  try {
    const result =
      kind === "events"
        ? await listYoungEventSubscriptions(auth.userId, query)
        : kind === "organizers"
          ? await listYoungOrganizerSubscriptions(auth.userId, query)
          : await listYoungNotifications(auth.userId, query);
    return jsonResponse(result, { headers: privateHeaders });
  } catch (error) {
    return handleRouteError("Unable to load Young workspace", error);
  }
}

export async function getYoungSubscriptionStateRoute(
  request: Request,
  youngId: string,
) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.young-subscription", action: "read" },
  });
  if (auth instanceof Response) return auth;
  try {
    return jsonResponse(await getYoungEventSubscription(auth.userId, youngId), {
      headers: privateHeaders,
    });
  } catch (error) {
    return handleRouteError("Unable to load subscription", error);
  }
}

export async function putYoungSubscriptionRoute(
  request: Request,
  id: string,
  kind: "events" | "organizers",
) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.young-subscription", action: "write" },
    rateLimit: { action: "workspace.young-subscription:write" },
  });
  if (auth instanceof Response) return auth;
  if (!id.trim() || id.length > 200)
    return errorResponse("Invalid identifier", 400);
  try {
    if (kind === "events") {
      const body = await parseRouteJsonBody(
        request,
        youngEventSubscriptionRequestSchema,
        "Invalid subscription",
      );
      if (body instanceof Response) return body;
      const { subscribed, ...settings } = body;
      return jsonResponse(
        await setYoungEventSubscription(auth.userId, id, subscribed, settings),
        { headers: privateHeaders },
      );
    }
    const body = await parseRouteJsonBody(
      request,
      youngOrganizerSubscriptionRequestSchema,
      "Invalid subscription",
    );
    if (body instanceof Response) return body;
    return jsonResponse(
      await setYoungOrganizerSubscription(auth.userId, id, body.subscribed),
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof YoungSubscriptionNotFoundError)
      return errorResponse(error.message, 404);
    return handleRouteError("Unable to update subscription", error);
  }
}

export async function postYoungNotificationReadRoute(
  request: Request,
  id: string,
) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.young-notification", action: "write" },
    rateLimit: { action: "workspace.young-notification:write" },
  });
  if (auth instanceof Response) return auth;
  try {
    const result = await readYoungNotification(auth.userId, id);
    return jsonResponse(
      result.success ? result : { error: "Notification not found" },
      {
        status: result.success ? 200 : 404,
        headers: privateHeaders,
      },
    );
  } catch (error) {
    return handleRouteError("Unable to read notification", error);
  }
}

export async function getPersonalCalendarRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.calendar", action: "read" },
  });
  if (auth instanceof Response) return auth;
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    personalCalendarQuerySchema,
    "Invalid calendar query",
  );
  if (query instanceof Response) return query;
  try {
    return jsonResponse(await listPersonalCalendarPage(auth.userId, query), {
      headers: privateHeaders,
    });
  } catch (error) {
    if (error instanceof InvalidCalendarRangeError)
      return errorResponse(error.message, 400);
    return handleRouteError("Unable to load calendar", error);
  }
}

export async function getYoungOrganizerStateRoute(
  request: Request,
  organizerId: string,
) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.young-subscription", action: "read" },
  });
  if (auth instanceof Response) return auth;
  try {
    return jsonResponse(
      await getYoungOrganizerSubscription(auth.userId, organizerId),
      { headers: privateHeaders },
    );
  } catch (error) {
    return handleRouteError("Unable to load subscription", error);
  }
}
