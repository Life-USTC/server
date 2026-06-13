import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import {
  buildLayoutCopy,
  layoutUserSummary,
} from "@/lib/shell/layout-server-data";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, request }) => {
  const session = hasRequestAuthSignal(request.headers)
    ? await import("@/lib/auth/core").then(({ getSessionFromHeaders }) =>
        getSessionFromHeaders(request.headers),
      )
    : null;
  return {
    locale: locals.locale,
    copy: buildLayoutCopy(locals.locale),
    user: layoutUserSummary(session?.user),
  };
};
