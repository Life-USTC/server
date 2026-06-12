import { getCourseListPage } from "@/lib/page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  return getCourseListPage(url, locals.locale);
};
