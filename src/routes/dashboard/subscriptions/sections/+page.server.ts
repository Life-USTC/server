import { redirect } from "@sveltejs/kit";
import { dashboardPageActions } from "@/features/dashboard/server/dashboard-page-actions";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  redirect(308, `/dashboard/subscriptions${event.url.search}`);
};

export const actions: Actions = dashboardPageActions;
