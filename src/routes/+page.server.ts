import { dashboardPageActions } from "@/features/dashboard/server/dashboard-page-actions";
import { loadDashboardPage } from "@/features/dashboard/server/dashboard-page-load";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = loadDashboardPage;
export const actions: Actions = dashboardPageActions;
