import { redirect } from "@sveltejs/kit";
import { workspaceTabCompatibilityRedirectHref } from "@/features/workspace/lib/workspace-nav";
import { workspacePageActions } from "@/features/workspace/server/workspace-page-actions";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const compatibilityHref = workspaceTabCompatibilityRedirectHref(
    event.url,
    event.request.method,
  );
  throw redirect(compatibilityHref ? 308 : 303, compatibilityHref ?? "/");
};

export const actions: Actions = workspacePageActions;
