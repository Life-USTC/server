import { redirect } from "@sveltejs/kit";
import { CATALOG_DETAIL_TAB_QUERY } from "@/features/catalog/lib/catalog-detail-tab";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const redirectUrl = new URL(`/catalog/courses/${params.jwId}`, url);
  for (const [key, value] of url.searchParams) {
    redirectUrl.searchParams.append(key, value);
  }
  redirectUrl.searchParams.set(CATALOG_DETAIL_TAB_QUERY, params.section);
  redirect(308, `${redirectUrl.pathname}${redirectUrl.search}`);
};

export const actions = {} satisfies Actions;
