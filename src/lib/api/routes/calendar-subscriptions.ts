import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { calendarSubscriptionCreateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getCurrentCalendarSubscriptionRoute(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const { getUserCalendarSubscription } = await import(
      "@/features/home/server/subscription-read-model"
    );
    const subscription = await getUserCalendarSubscription(userId);

    if (!subscription) {
      return jsonResponse({ subscription: null });
    }

    return jsonResponse({ subscription });
  } catch (error) {
    return handleRouteError("Failed to fetch calendar subscription", error);
  }
}

export async function postCalendarSubscriptionsRoute(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const parsedBody = await parseRouteJsonBody(
      request,
      calendarSubscriptionCreateRequestSchema,
      "Invalid subscription request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const sectionIds = parsedBody.sectionIds ?? [];
    const { replaceUserSectionSubscriptions } = await import(
      "@/features/home/server/subscriptions"
    );
    const subscription = await replaceUserSectionSubscriptions(
      userId,
      sectionIds,
    );

    return jsonResponse({ subscription });
  } catch (error) {
    return handleRouteError("Failed to update calendar subscription", error);
  }
}
