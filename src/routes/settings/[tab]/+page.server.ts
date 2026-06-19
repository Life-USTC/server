import { error } from "@sveltejs/kit";
import { isSettingsTab } from "@/features/settings/lib/settings-tabs";
import { actions, load as loadSettings } from "../+page.server";
import type { PageServerLoad } from "./$types";

type SettingsLoadEvent = Parameters<typeof loadSettings>[0];

export const load: PageServerLoad = async (event) => {
  if (!isSettingsTab(event.params.tab)) {
    error(404, "Settings page not found");
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", event.params.tab);

  return loadSettings({ ...event, url } as unknown as SettingsLoadEvent);
};

export { actions };
