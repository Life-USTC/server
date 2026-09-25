import { redirect } from "@sveltejs/kit";
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
  return toLoadData({
    userId,
    copy: getWorkspacePageCopy(locals.locale),
    unread: url.searchParams.get("unread") === "true",
    events:
      view !== "organizers" && view !== "notifications"
        ? await listYoungEventSubscriptions(userId, input)
        : null,
    organizers:
      view === "organizers"
        ? await listYoungOrganizerSubscriptions(userId, input)
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
