import { MAX_PINNED_LINKS } from "@/features/catalog-links/server/catalog-link-service";
import { jsonResponse } from "@/lib/api/helpers";

export function jsonOrRedirectForPinnedLinks({
  request,
  wantsJson,
  pinnedSlugs,
  returnTo,
  status = 200,
  error = null,
}: {
  request: Request;
  wantsJson: boolean;
  pinnedSlugs: string[];
  returnTo: string;
  status?: number;
  error?: string | null;
}) {
  if (wantsJson) {
    return jsonResponse(
      { pinnedSlugs, maxPinnedLinks: MAX_PINNED_LINKS, error },
      { status },
    );
  }

  const redirectUrl = new URL(returnTo, request.url);
  if (status >= 400) {
    redirectUrl.searchParams.set("workspaceLinkPinError", "1");
  } else {
    redirectUrl.searchParams.delete("workspaceLinkPinError");
  }

  return Response.redirect(redirectUrl, 303);
}
