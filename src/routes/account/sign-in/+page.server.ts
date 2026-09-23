import {
  loadSignInPage,
  signInPageDefaultAction,
} from "@/features/auth/server/signin-page-server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = loadSignInPage;

export const actions: Actions = {
  default: signInPageDefaultAction,
};
