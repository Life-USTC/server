import {
  loadWelcomePage,
  welcomeActions,
} from "@/features/welcome/server/welcome-page-server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = loadWelcomePage;
export const actions: Actions = welcomeActions;
