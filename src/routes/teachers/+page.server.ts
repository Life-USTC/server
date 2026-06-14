import { getTeacherListPage } from "@/lib/page-data";
import { PUBLIC_CATALOG_CACHE_CONTROL } from "@/lib/public-cache-control";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, setHeaders, url }) => {
  setHeaders({ "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL });
  return getTeacherListPage(url, locals.locale);
};
