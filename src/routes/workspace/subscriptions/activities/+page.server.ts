import { redirect } from "@sveltejs/kit";
import {
  getDemoCopy,
  getDemoView,
} from "@/features/demo/server/demo-workspace";
import {
  getDemoUnreadYoungNotificationsCount,
  getDemoYoungEventSubscriptions,
  getDemoYoungNotifications,
  getDemoYoungOrganizerSubscriptions,
} from "@/features/demo/server/demo-young-workspace";
import {
  countUnreadYoungNotifications,
  listYoungNotifications,
} from "@/features/young/server/young-notification-service";
import {
  listYoungEventSubscriptions,
  listYoungOrganizerSubscriptions,
} from "@/features/young/server/young-subscription-service";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { parsePositivePage, toLoadData } from "@/lib/load-data-utils";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  if (locals.demo) {
    const view = url.searchParams.get("view") ?? "events";
    const input = {
      page: parsePositivePage(url.searchParams.get("page")),
      pageSize: 20,
    };
    const unread = url.searchParams.get("unread") === "true";
    const notifications =
      view === "notifications"
        ? getDemoYoungNotifications(locals.locale, { ...input, unread })
        : null;
    const organizers =
      view === "organizers"
        ? getDemoYoungOrganizerSubscriptions(locals.locale, input)
        : null;
    const events =
      view !== "organizers" && view !== "notifications"
        ? getDemoYoungEventSubscriptions(locals.locale, input)
        : null;
    const lastPage = Math.max(
      1,
      (notifications ?? events ?? organizers)?.pagination.totalPages ?? 1,
    );
    if (input.page > lastPage) {
      const query = new URLSearchParams(url.searchParams);
      query.set("page", String(lastPage));
      redirect(303, `${url.pathname}?${query}`);
    }
    return toLoadData({
      userId: `demo:${locals.demo.fixtureVersion}`,
      locale: locals.locale,
      copy: getWorkspacePageCopy(locals.locale),
      unread,
      events,
      organizers,
      notifications,
      unreadActivityNotificationsCount: getDemoUnreadYoungNotificationsCount(),
      demo: getDemoView(locals.demo, locals.locale),
      youngWorkspaceSampleNotice: getDemoCopy(locals.locale)
        .youngWorkspaceSamples,
      youngSubscriptionFactsLabel: getDemoCopy(locals.locale)
        .youngSubscriptionFacts,
    });
  }
  const userId = locals.authUser?.id;
  if (!userId) redirect(303, buildSignInPageUrl(url.pathname + url.search));
  setHeaders({ "Cache-Control": "private, no-store" });
  const view = url.searchParams.get("view") ?? "events";
  const input = {
    page: parsePositivePage(url.searchParams.get("page")),
    pageSize: 20,
  };
  const notifications =
    view === "notifications"
      ? await listYoungNotifications(userId, {
          ...input,
          unread: url.searchParams.get("unread") === "true",
        })
      : null;
  const events =
    view !== "organizers" && view !== "notifications"
      ? await listYoungEventSubscriptions(userId, input)
      : null;
  const organizers =
    view === "organizers"
      ? await listYoungOrganizerSubscriptions(userId, input)
      : null;
  const result = notifications ?? events ?? organizers;
  const lastPage = Math.max(1, result?.pagination.totalPages ?? 1);
  if (input.page > lastPage) {
    const query = new URLSearchParams(url.searchParams);
    query.set("page", String(lastPage));
    redirect(303, `${url.pathname}?${query}`);
  }
  return toLoadData({
    demo: null,
    locale: locals.locale,
    youngWorkspaceSampleNotice: null,
    youngSubscriptionFactsLabel: null,
    userId,
    copy: getWorkspacePageCopy(locals.locale),
    unread: url.searchParams.get("unread") === "true",
    events: events
      ? {
          ...events,
          data: events.data.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
        }
      : null,
    organizers: organizers
      ? {
          ...organizers,
          data: organizers.data.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
        }
      : null,
    notifications: notifications
      ? {
          ...notifications,
          data: notifications.data.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
            readAt: row.readAt?.toISOString() ?? null,
            expiresAt: row.expiresAt?.toISOString() ?? null,
          })),
        }
      : null,
    unreadActivityNotificationsCount:
      await countUnreadYoungNotifications(userId),
  });
};
