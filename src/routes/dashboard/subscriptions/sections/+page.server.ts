import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  redirect(308, `/dashboard/subscriptions${event.url.search}`);
};
