import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const DASHBOARD_TABS = new Set([
  "overview",
  "calendar",
  "bus",
  "links",
  "homeworks",
  "todos",
  "exams",
  "subscriptions",
]);
export const load: PageServerLoad = async (event) => {
  if (!DASHBOARD_TABS.has(event.params.tab)) {
    error(404, "Dashboard page not found");
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", event.params.tab);
  url.pathname = "/";

  throw redirect(303, `${url.pathname}${url.search}`);
};
