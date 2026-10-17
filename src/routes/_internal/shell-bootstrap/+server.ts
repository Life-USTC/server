import {
  getWorkspaceNavigationSummary,
  listShellSubscribedSections,
} from "@/features/workspace/server/workspace-navigation-summary";
import {
  privateSessionJson,
  rejectBearerOnSessionRoute,
} from "@/lib/api/internal-session-response";
import { logRouteFailure } from "@/lib/log/app-logger";
import { layoutUserSummary } from "@/lib/shell/layout-server-data";
import type { ShellBootstrapPayload } from "@/lib/shell/shell-bootstrap";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, request }) => {
  const rejected = rejectBearerOnSessionRoute(request);
  if (rejected) return rejected;

  const viewer = layoutUserSummary(locals.authUser);
  if (!viewer) {
    return privateSessionJson({
      viewer: null,
      navigation: null,
      subscribedSections: [],
    } satisfies ShellBootstrapPayload);
  }

  try {
    const navigation = await getWorkspaceNavigationSummary(viewer.id);
    let subscribedSections: ShellBootstrapPayload["subscribedSections"] = [];
    try {
      subscribedSections = await listShellSubscribedSections(
        viewer.id,
        locals.locale,
      );
    } catch (error) {
      logRouteFailure(
        "Failed to load subscribed sections for the shell",
        500,
        error,
        {
          source: "web-shell-bootstrap",
        },
      );
    }
    return privateSessionJson({
      viewer,
      navigation,
      subscribedSections,
    } satisfies ShellBootstrapPayload);
  } catch (error) {
    logRouteFailure("Failed to load shell bootstrap", 500, error, {
      source: "web-shell-bootstrap",
    });
    return privateSessionJson({
      viewer,
      navigation: null,
      subscribedSections: [],
    } satisfies ShellBootstrapPayload);
  }
};

export const fallback: RequestHandler = () =>
  privateSessionJson(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "GET" } },
  );
