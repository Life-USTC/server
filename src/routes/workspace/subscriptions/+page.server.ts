import { redirect } from "@sveltejs/kit";
import { workspacePageActions } from "@/features/workspace/server/workspace-page-actions";
import { loadSignedWorkspacePage } from "@/features/workspace/server/workspace-page-load";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.authUser?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  return loadSignedWorkspacePage({
    locals: event.locals,
    request: event.request,
    tab: "subscriptions",
    url: event.url,
    userId: event.locals.authUser.id,
  });
};

export const actions: Actions = workspacePageActions;
