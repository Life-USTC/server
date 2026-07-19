import { redirect } from "@sveltejs/kit";
import { settingsPageActions } from "@/features/settings/server/settings-page-actions";
import { loadSettingsPage } from "@/features/settings/server/settings-page-load";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => {
  if (event.url.searchParams.get("tab") === "preferences") {
    const canonicalUrl = new URL(event.url);
    canonicalUrl.pathname = "/settings/preferences";
    canonicalUrl.searchParams.delete("tab");
    redirect(308, `${canonicalUrl.pathname}${canonicalUrl.search}`);
  }

  return loadSettingsPage(event);
};
export const actions: Actions = settingsPageActions;
