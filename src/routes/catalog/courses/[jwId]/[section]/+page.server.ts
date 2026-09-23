import { error, redirect } from "@sveltejs/kit";
import {
  catalogDetailHashForTab,
  isCatalogDetailLegacyPathTab,
  parseCatalogDetailTab,
} from "@/features/catalog/lib/catalog-detail-tab";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  if (!isCatalogDetailLegacyPathTab(params.section)) {
    error(404);
  }

  const tab = parseCatalogDetailTab(params.section);
  const redirectUrl = new URL(`/catalog/courses/${params.jwId}`, url);
  for (const [key, value] of url.searchParams) {
    if (key === "tab") continue;
    redirectUrl.searchParams.append(key, value);
  }
  redirect(
    308,
    `${redirectUrl.pathname}${redirectUrl.search}${catalogDetailHashForTab(tab)}`,
  );
};

export const actions = {} satisfies Actions;
