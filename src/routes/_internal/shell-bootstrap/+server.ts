import { getWorkspaceNavigationSummary } from "@/features/workspace/server/workspace-navigation-summary";
import { jsonResponse } from "@/lib/api/responses";
import { logRouteFailure } from "@/lib/log/app-logger";
import { layoutUserSummary } from "@/lib/shell/layout-server-data";
import type { ShellBootstrapPayload } from "@/lib/shell/shell-bootstrap";
import type { RequestHandler } from "./$types";

const PRIVATE_SESSION_HEADERS = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "Cookie",
} as const;

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(PRIVATE_SESSION_HEADERS)) {
    headers.set(name, value);
  }
  return jsonResponse(body, {
    ...init,
    headers,
  });
}

export const GET: RequestHandler = async ({ locals, request }) => {
  if (request.headers.has("authorization")) {
    return privateJson(
      { error: "Session authentication required" },
      { status: 401 },
    );
  }

  const viewer = layoutUserSummary(locals.authUser);
  if (!viewer) {
    return privateJson({
      viewer: null,
      navigation: null,
    } satisfies ShellBootstrapPayload);
  }

  try {
    const navigation = await getWorkspaceNavigationSummary(viewer.id);
    return privateJson({ viewer, navigation } satisfies ShellBootstrapPayload);
  } catch (error) {
    logRouteFailure("Failed to load shell bootstrap", 500, error, {
      source: "web-shell-bootstrap",
    });
    return privateJson(
      { error: "Failed to load shell bootstrap" },
      { status: 500 },
    );
  }
};

export const fallback: RequestHandler = () =>
  privateJson(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "GET" } },
  );
