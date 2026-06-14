import { getTeacherListPage } from "@/lib/page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  return getTeacherListPage(url, locals.locale);
};
