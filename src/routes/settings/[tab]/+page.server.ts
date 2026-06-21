import { error } from "@sveltejs/kit";
import { isSettingsTab } from "@/features/settings/lib/settings-tabs";
import { settingsPageActions } from "@/features/settings/server/settings-page-actions";
import { loadSettingsPage } from "@/features/settings/server/settings-page-load";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!isSettingsTab(event.params.tab)) {
    error(404, "Settings page not found");
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", event.params.tab);

  return loadSettingsPage({
    locals: event.locals,
    request: event.request,
    url,
  });
};

export const actions: Actions = settingsPageActions;
