import { error, redirect } from "@sveltejs/kit";
import { getDemoTodosPage } from "@/features/demo/server/demo-todos";
import { isWorkspaceTab } from "@/features/workspace/lib/workspace-nav";
import { workspacePageActions } from "@/features/workspace/server/workspace-page-actions";
import { loadSignedWorkspacePage } from "@/features/workspace/server/workspace-page-load";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (event.params.tab === "overview") {
    throw redirect(308, `/${event.url.search}`);
  }
  // Private tab data must reload when navigation refreshes the shell identity.
  await event.parent();
  if (!isWorkspaceTab(event.params.tab)) {
    error(404, "Workspace page not found");
  }
  if (event.locals.demo && event.params.tab === "todos") {
    return getDemoTodosPage(event.locals.demo, event.locals.locale);
  }
  if (!event.locals.authUser?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  return loadSignedWorkspacePage({
    locals: event.locals,
    request: event.request,
    tab: event.params.tab,
    url: event.url,
    userId: event.locals.authUser.id,
  });
};

export const actions: Actions = workspacePageActions;
