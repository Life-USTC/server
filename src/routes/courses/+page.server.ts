import { getCourseListPage } from "@/features/catalog/server/public-page-list-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  return getCourseListPage(url, locals.locale);
};
