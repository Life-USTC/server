import { getSectionListPage } from "@/lib/page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  return getSectionListPage(url, locals.locale);
};
