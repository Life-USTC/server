import {
  buildLayoutCopy,
  layoutUserSummary,
} from "@/lib/shell/layout-server-data";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, request }) => {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  return {
    locale: locals.locale,
    copy: buildLayoutCopy(locals.locale),
    user: layoutUserSummary(session?.user),
  };
};
