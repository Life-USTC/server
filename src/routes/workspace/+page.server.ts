import { redirect } from "@sveltejs/kit";
import { workspaceTabCompatibilityRedirectHref } from "@/features/workspace/lib/workspace-nav";
import { workspacePageActions } from "@/features/workspace/server/workspace-page-actions";
import { loadSignedWorkspacePage } from "@/features/workspace/server/workspace-page-load";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const compatibilityHref = workspaceTabCompatibilityRedirectHref(
    event.url,
    event.request.method,
  );
  if (compatibilityHref) {
    throw redirect(308, compatibilityHref);
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
    tab: "overview",
    url: event.url,
    userId: event.locals.authUser.id,
  });
};

export const actions: Actions = workspacePageActions;
