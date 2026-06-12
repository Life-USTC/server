import {
  loadSectionDetailPage,
  subscribeSectionAction,
  unsubscribeSectionAction,
} from "@/features/section-detail/server/section-detail-page-server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = loadSectionDetailPage;

export const actions: Actions = {
  subscribe: subscribeSectionAction,
  unsubscribe: unsubscribeSectionAction,
};
