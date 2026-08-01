import { error, redirect } from "@sveltejs/kit";
import {
  CATALOG_DETAIL_TAB_QUERY,
  isCatalogDetailLegacyPathTab,
} from "@/features/catalog/lib/catalog-detail-tab";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  if (!isCatalogDetailLegacyPathTab(params.section)) {
    error(404);
  }

  const redirectUrl = new URL(`/catalog/teachers/${params.id}`, url);
  for (const [key, value] of url.searchParams) {
    redirectUrl.searchParams.append(key, value);
  }
  redirectUrl.searchParams.set(CATALOG_DETAIL_TAB_QUERY, params.section);
  redirect(308, `${redirectUrl.pathname}${redirectUrl.search}`);
};
