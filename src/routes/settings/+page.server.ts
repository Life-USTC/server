import { settingsPageActions } from "@/features/settings/server/settings-page-actions";
import { loadSettingsPage } from "@/features/settings/server/settings-page-load";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = loadSettingsPage;
export const actions: Actions = settingsPageActions;
