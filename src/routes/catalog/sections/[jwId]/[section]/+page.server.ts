import { redirect } from "@sveltejs/kit";
import { SECTION_DETAIL_TAB_QUERY } from "@/features/section-detail/lib/section-detail-tab";
import {
  subscribeSectionAction,
  unsubscribeSectionAction,
} from "@/features/section-detail/server/section-detail-page-server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const redirectUrl = new URL(`/catalog/sections/${params.jwId}`, url);
  for (const [key, value] of url.searchParams) {
    redirectUrl.searchParams.append(key, value);
  }
  redirectUrl.searchParams.set(SECTION_DETAIL_TAB_QUERY, params.section);
  redirect(308, `${redirectUrl.pathname}${redirectUrl.search}`);
};

export const actions: Actions = {
  subscribe: subscribeSectionAction,
  unsubscribe: unsubscribeSectionAction,
};
