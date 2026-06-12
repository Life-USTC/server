import {
  loadOAuthAuthorizePage,
  oauthAuthorizeActions,
} from "@/features/oauth/server/oauth-authorize-page-server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = loadOAuthAuthorizePage;
export const actions: Actions = oauthAuthorizeActions;
