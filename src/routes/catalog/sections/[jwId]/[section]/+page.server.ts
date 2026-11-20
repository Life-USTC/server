import { redirect } from "@sveltejs/kit";
import {
  isSectionDetailTab,
  sectionDetailHashForTab,
} from "@/features/section-detail/lib/section-detail-tab";
import {
  subscribeSectionAction,
  unsubscribeSectionAction,
} from "@/features/section-detail/server/section-detail-page-server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const hash = isSectionDetailTab(params.section)
    ? sectionDetailHashForTab(params.section)
    : "";
  const redirectUrl = new URL(`/catalog/sections/${params.jwId}`, url);
  for (const [key, value] of url.searchParams) {
    if (key === "tab") continue;
    redirectUrl.searchParams.append(key, value);
  }
  redirect(308, `${redirectUrl.pathname}${redirectUrl.search}${hash}`);
};

export const actions: Actions = {
  subscribe: subscribeSectionAction,
  unsubscribe: unsubscribeSectionAction,
};
