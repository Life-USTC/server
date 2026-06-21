import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { parseSectionMatchCodesRequest } from "@/lib/api/routes/academic-section-route-request";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
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

export async function postCalendarSubscriptionImportCodesRoute(
  request: Request,
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const parsedBody = await parseSectionMatchCodesRequest(request);
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const locale = getRequestLocale(request);
    const [
      { findSectionCodeMatches },
      { getSubscribedSectionIds, getUserCalendarSubscription },
      { addUserSectionSubscriptions },
    ] = await Promise.all([
      import("@/lib/course-section-queries"),
      import("@/features/home/server/subscription-read-model"),
      import("@/features/home/server/subscriptions"),
    ]);

    const matches = await findSectionCodeMatches(
      parsedBody.codes,
      locale,
      parsedBody.semesterId,
    );
    if (!matches) {
      return notFound("No semester found");
    }

    const existingIds = new Set(await getSubscribedSectionIds(userId));
    const addedSections = matches.sections.filter(
      (section) => !existingIds.has(section.id),
    );
    const alreadySubscribedSections = matches.sections.filter((section) =>
      existingIds.has(section.id),
    );

    await addUserSectionSubscriptions(
      userId,
      matches.sections.map((section) => section.id),
    );
    const subscription = await getUserCalendarSubscription(userId, locale);

    return jsonResponse({
      success: true,
      semester: matches.semester,
      matchedCodes: matches.matchedCodes,
      unmatchedCodes: matches.unmatchedCodes,
      ambiguousCodes: [],
      sections: matches.sections,
      addedCount: addedSections.length,
      addedSections,
      alreadySubscribedCount: alreadySubscribedSections.length,
      alreadySubscribedSections,
      subscription,
    });
  } catch (error) {
    return handleRouteError("Failed to import section subscriptions", error);
  }
}
