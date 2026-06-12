import { getSessionFromHeaders } from "@/lib/auth/core";
import { getViewerContext } from "@/lib/auth/viewer-context";

export async function currentCatalogViewer(request: Request) {
  const userId =
    (await getSessionFromHeaders(request.headers))?.user?.id ?? null;
  return getViewerContext({ userId });
}
