import {
  buildLayoutCopy,
  layoutUserSummary,
} from "@/lib/shell/layout-server-data";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    locale: locals.locale,
    copy: buildLayoutCopy(locals.locale),
    user: layoutUserSummary(locals.authUser),
  };
};
