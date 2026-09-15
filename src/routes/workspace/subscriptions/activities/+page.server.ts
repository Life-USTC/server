import { redirect } from "@sveltejs/kit";
import { listYoungNotifications } from "@/features/young/server/young-notification-service";
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
  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    events:
      view !== "organizers" && view !== "notifications"
        ? await listYoungEventSubscriptions(userId, input)
        : null,
    organizers:
      view === "organizers"
        ? await listYoungOrganizerSubscriptions(userId, input)
        : null,
    notifications:
      view === "notifications"
        ? await listYoungNotifications(userId, input)
        : null,
  });
};
