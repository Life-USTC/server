import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseInteger,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { parseSectionMatchCodesRequest } from "@/lib/api/routes/academic-section-route-request";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import {
  calendarSubscriptionAppendRequestSchema,
  calendarSubscriptionBatchRequestSchema,
  calendarSubscriptionCreateRequestSchema,
  calendarSubscriptionQueryRequestSchema,
  calendarSubscriptionRemoveRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getCurrentCalendarSubscriptionRoute(request: Request) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "subscription", action: "read" },
    });
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const { getUserCalendarSubscription } = await import(
      "@/features/subscriptions/server/subscription-read-model"
    );
    const subscription = await getUserCalendarSubscription(
      userId,
      getRequestLocale(request),
    );

    if (!subscription) {
      return jsonResponse({ subscription: null });
    }

    return jsonResponse({ subscription });
  } catch (error) {
    return handleRouteError("Failed to fetch calendar subscription", error);
  }
}

function parsedSubscriptionSemesterId(semesterId: string | number | undefined) {
  if (semesterId === undefined) {
    return { ok: true as const, value: undefined };
  }

  const parsed = parseInteger(String(semesterId));
  if (parsed === null) {
    return { ok: false as const };
  }
  return { ok: true as const, value: parsed };
}

export async function postCalendarSubscriptionsRoute(request: Request) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "subscription", action: "write" },
      rateLimit: { action: "subscription:batch-write", tier: "batch" },
    });
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
      "@/features/subscriptions/server/subscriptions"
    );
    const subscription = await replaceUserSectionSubscriptions(
      userId,
      sectionIds,
      getRequestLocale(request),
    );

    return jsonResponse({ subscription });
  } catch (error) {
    return handleRouteError("Failed to update calendar subscription", error);
  }
}

export async function postCalendarSubscriptionQueryRoute(request: Request) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "subscription", action: "read" },
    });
    if (auth instanceof Response) return auth;

    const parsedBody = await parseRouteJsonBody(
      request,
      calendarSubscriptionQueryRequestSchema,
      "Invalid subscription query request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const parsedSemesterId = parsedSubscriptionSemesterId(
      parsedBody.semesterId,
    );
    if (!parsedSemesterId.ok) {
      return badRequest("semesterId must be a valid number");
    }

    const { resolveCalendarSubscriptionSections } = await import(
      "@/features/subscriptions/server/subscriptions"
    );
    const result = await resolveCalendarSubscriptionSections({
      codes: parsedBody.codes,
      locale: getRequestLocale(request),
      sectionIds: parsedBody.sectionIds,
      semesterId: parsedSemesterId.value,
    });
    if (!result) {
      return notFound("No semester found");
    }

    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to query section subscriptions", error);
  }
}

export async function postCalendarSubscriptionBatchRoute(request: Request) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "subscription", action: "write" },
      rateLimit: { action: "subscription:batch-write", tier: "batch" },
    });
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const parsedBody = await parseRouteJsonBody(
      request,
      calendarSubscriptionBatchRequestSchema,
      "Invalid subscription batch request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const parsedSemesterId = parsedSubscriptionSemesterId(
      parsedBody.semesterId,
    );
    if (!parsedSemesterId.ok) {
      return badRequest("semesterId must be a valid number");
    }

    const { batchUpdateUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscriptions"
    );
    const result = await batchUpdateUserSectionSubscriptions({
      action: parsedBody.action,
      codes: parsedBody.codes,
      locale: getRequestLocale(request),
      sectionIds: parsedBody.sectionIds,
      semesterId: parsedSemesterId.value,
      userId,
    });
    if (!result) {
      return notFound("No semester found");
    }

    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to update section subscriptions", error);
  }
}

export async function postCalendarSubscriptionImportCodesRoute(
  request: Request,
) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "subscription", action: "write" },
      rateLimit: { action: "subscription:batch-write", tier: "batch" },
    });
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const parsedBody = await parseSectionMatchCodesRequest(request);
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const locale = getRequestLocale(request);
    const { importUserSectionSubscriptionsByCodes } = await import(
      "@/features/subscriptions/server/subscriptions"
    );
    const result = await importUserSectionSubscriptionsByCodes({
      codes: parsedBody.codes,
      locale,
      semesterId: parsedBody.semesterId,
      userId,
    });
    if (!result) {
      return notFound("No semester found");
    }
    const { alreadySubscribedSections, addedSections, matches, subscription } =
      result;

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

export async function patchCalendarSubscriptionsRoute(request: Request) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "subscription", action: "write" },
      rateLimit: { action: "subscription:batch-write", tier: "batch" },
    });
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const parsedBody = await parseRouteJsonBody(
      request,
      calendarSubscriptionAppendRequestSchema,
      "Invalid subscription append request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const { appendUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscriptions"
    );
    const result = await appendUserSectionSubscriptions({
      locale: getRequestLocale(request),
      sectionIds: parsedBody.sectionIds,
      userId,
    });
    if (!result) {
      return notFound();
    }

    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to append section subscriptions", error);
  }
}

export async function deleteCalendarSubscriptionsRoute(request: Request) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "subscription", action: "write" },
      rateLimit: { action: "subscription:batch-write", tier: "batch" },
    });
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const parsedBody = await parseRouteJsonBody(
      request,
      calendarSubscriptionRemoveRequestSchema,
      "Invalid subscription remove request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const { getUserCalendarSubscription, removeUserSectionSubscriptions } =
      await import("@/features/subscriptions/server/subscriptions");
    const result = await removeUserSectionSubscriptions(
      userId,
      parsedBody.sectionIds,
    );
    if (!result) {
      return notFound();
    }

    const subscription = await getUserCalendarSubscription(
      userId,
      getRequestLocale(request),
    );
    return jsonResponse({ subscription });
  } catch (error) {
    return handleRouteError("Failed to remove section subscriptions", error);
  }
}
