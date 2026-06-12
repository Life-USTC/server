import { redirect } from "@sveltejs/kit";
import { actions as dashboardActions } from "../../../+page.server";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  redirect(308, `/dashboard/subscriptions${event.url.search}`);
};

export const actions = dashboardActions;
