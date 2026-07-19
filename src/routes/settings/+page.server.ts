import { redirect } from "@sveltejs/kit";
import { settingsTabCompatibilityRedirectHref } from "@/features/settings/lib/settings-tabs";
import { settingsPageActions } from "@/features/settings/server/settings-page-actions";
import { loadSettingsPage } from "@/features/settings/server/settings-page-load";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const compatibilityHref = settingsTabCompatibilityRedirectHref(
    event.url,
    event.request.method,
  );
  if (compatibilityHref) {
    redirect(308, compatibilityHref);
  }

  return loadSettingsPage({ ...event, tab: "profile" });
};
export const actions: Actions = settingsPageActions;
