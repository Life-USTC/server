import { loadSignedWorkspacePage } from "@/features/workspace/server/workspace-page-load";
import {
  privateSessionJson,
  rejectBearerOnSessionRoute,
} from "@/lib/api/internal-session-response";
import { logRouteFailure } from "@/lib/log/app-logger";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const rejected = rejectBearerOnSessionRoute(event.request);
  if (rejected) return rejected;
  const userId = event.locals.authUser?.id;
  if (!userId) return privateSessionJson({ signedIn: false });
  try {
    const { copy: _copy, ...overview } = await loadSignedWorkspacePage({
      ...event,
      tab: "overview",
      userId,
    });
    if ("userMissing" in overview) {
      return privateSessionJson({ signedIn: false }, { status: 404 });
    }
    return privateSessionJson(overview);
  } catch (error) {
    logRouteFailure("Failed to load home overview", 500, error, {
      source: "home-viewer",
    });
    return privateSessionJson(
      { error: "Failed to load home overview" },
      { status: 500 },
    );
  }
};

export const fallback: RequestHandler = () =>
  privateSessionJson(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "GET" } },
  );
