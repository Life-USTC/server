import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import {
  classifyFeatureStatus,
  type FeatureOperation,
  type FeatureOperationContext,
  observeFeatureOperation,
} from "./feature-operation";

const CATALOG = {
  courses: "catalog.course",
  sections: "catalog.section",
  teachers: "catalog.teacher",
} as const;

/** Match only the explicitly instrumented operation inventory, never arbitrary path IDs. */
export function resolveHttpFeatureOperation(
  url: URL,
  method: string,
): FeatureOperation | null {
  const path = url.pathname.replace(/\/__data\.json$/, "");
  const read = method === "GET";
  if (read && path === "/api/search")
    return { feature: "catalog.search", operation: "search" };
  if (method === "POST" && path === "/api/catalog/sections/match-codes")
    return { feature: "catalog.section", operation: "match" };
  const catalog =
    /^\/api\/catalog\/(courses|sections|teachers)(?:\/([^/]+))?$/.exec(path);
  if (read && catalog) {
    if (catalog[2] && !/^\d+$/.test(catalog[2])) return null;
    return {
      feature: CATALOG[catalog[1] as keyof typeof CATALOG],
      operation: catalog[2]
        ? "get"
        : url.searchParams.has("search")
          ? "search"
          : "list",
    };
  }
  if (read && path === "/api/workspace/overview")
    return { feature: "workspace.overview", operation: "get" };
  if (path === "/api/workspace/homeworks" && read)
    return { feature: "workspace.homework", operation: "list" };
  if (
    /^\/api\/workspace\/homeworks\/[^/]+\/completion$/.test(path) &&
    method === "PUT"
  )
    return { feature: "workspace.homework", operation: "set_completion" };
  if (path === "/api/workspace/homeworks/completions" && method === "PUT")
    return { feature: "workspace.homework", operation: "batch" };
  const subscription = /^\/api\/workspace\/subscriptions(?:\/([^/]+))?$/.exec(
    path,
  );
  if (subscription) {
    const suffix = subscription[1];
    if (
      (read && suffix === "current") ||
      (method === "POST" && suffix === "query")
    )
      return { feature: "workspace.subscription", operation: "list" };
    if (method === "POST" && suffix === "import-codes")
      return { feature: "workspace.subscription", operation: "import" };
    if (method === "POST" && suffix === "batch")
      return { feature: "workspace.subscription", operation: "batch" };
    if (!suffix && (method === "PATCH" || method === "DELETE"))
      return { feature: "workspace.subscription", operation: "batch" };
    if (suffix && /^\d+$/.test(suffix) && method === "PATCH")
      return { feature: "workspace.subscription", operation: "update" };
  }
  const homework = /^\/api\/community\/section-homeworks(?:\/([^/]+))?$/.exec(
    path,
  );
  if (homework && homework[1] !== "audit") {
    const operation = read
      ? homework[1]
        ? "get"
        : "list"
      : !homework[1] && method === "POST"
        ? "create"
        : homework[1] && method === "PATCH"
          ? "update"
          : homework[1] && method === "DELETE"
            ? "delete"
            : null;
    if (operation) return { feature: "community.section-homework", operation };
  }
  // Page view is deliberately distinct from an API read and includes SSR cache hits.
  if (read && path === "/search")
    return { feature: "catalog.search", operation: "view" };
  const page = /^\/catalog\/(courses|sections|teachers)(?:\/[^/]+)?$/.exec(
    path,
  );
  if (read && page)
    return {
      feature: CATALOG[page[1] as keyof typeof CATALOG],
      operation: "view",
    };
  if (read && (path === "/workspace" || path === "/workspace/overview"))
    return { feature: "workspace.overview", operation: "view" };
  if (read && /^\/workspace\/subscriptions(?:\/sections)?$/.test(path))
    return { feature: "workspace.subscription", operation: "view" };
  if (read && path === "/workspace/homeworks")
    return { feature: "workspace.homework", operation: "view" };
  return null;
}

export function httpFeatureContext(
  request: Request,
  requestId?: string,
): FeatureOperationContext | null {
  const url = new URL(request.url);
  // Prefetch is traffic, not a demonstrated use. Existing request telemetry still records it.
  if (
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch")
  )
    return null;
  const operation = resolveHttpFeatureOperation(url, request.method);
  if (!operation) return null;
  const web = !url.pathname.startsWith("/api/");
  return {
    ...operation,
    protocol: web ? "web" : "rest",
    surface: web ? "web" : "unknown",
    // A credential signal is not proof of authentication. Never add a session lookup for telemetry.
    authMode: hasRequestAuthSignal(request.headers) ? "unknown" : "anonymous",
    requestId,
  };
}

export function observeHttpFeature(
  request: Request,
  requestId: string | undefined,
  run: () => Response | Promise<Response>,
): Promise<Response> | Response {
  const context = httpFeatureContext(request, requestId);
  // SvelteKit can encode load errors and redirects in an HTTP 200 response.
  // Leave application outcomes unknown rather than reading or buffering its stream.
  const dataEnvelope =
    context?.protocol === "web" &&
    new URL(request.url).pathname.endsWith("/__data.json");
  return context
    ? observeFeatureOperation(context, run, (response) =>
        response.ok && dataEnvelope
          ? { outcome: "unknown", errorClass: "none" }
          : response.ok &&
              (context.operation === "batch" || context.operation === "import")
            ? { outcome: "unknown", errorClass: "unknown" }
            : classifyFeatureStatus(response.status),
      )
    : run();
}
