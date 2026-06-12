import {
  adminBusActions,
  loadAdminBusPage,
} from "@/features/admin/server/admin-bus-page-server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = loadAdminBusPage;
export const actions: Actions = adminBusActions;
