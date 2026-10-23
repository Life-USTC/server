/**
 * Tabs served by the dynamic `/workspace/[tab]` route.
 * Subscriptions lives at `/workspace/subscriptions` instead; see `workspaceNavTabIds`.
 */
export const workspaceTabIds = [
  "overview",
  "calendar",
  "homeworks",
  "todos",
  "exams",
] as const;

export type WorkspaceTabId = (typeof workspaceTabIds)[number];

/** Static-route workspace section excluded from `[tab]`. */
export const WORKSPACE_SUBSCRIPTIONS_SECTION = "subscriptions" as const;

export const workspaceNavTabIds = [
  ...workspaceTabIds,
  WORKSPACE_SUBSCRIPTIONS_SECTION,
] as const;

export type WorkspaceNavTabId = (typeof workspaceNavTabIds)[number];

export const WORKSPACE_SUBSCRIPTIONS_PATH = "/workspace/subscriptions";

const workspaceTabIdSet = new Set<string>(workspaceTabIds);
const workspaceNavTabIdSet = new Set<string>(workspaceNavTabIds);
const legacyHomeTabIdSet = new Set<string>([
  ...workspaceNavTabIds,
  "bus",
  "links",
]);

/**
 * Permanent compatibility for bookmarked `?tab=` query URLs from the pre-semantic
 * workspace shell. Supported entry points:
 * - `/`: `homeTabCompatibilityRedirectHref` (catalog + workspace tabs), for every
 *   visitor alike — `/` is the one home and no longer forwards a signed-in
 *   viewer anywhere, so this redirect is viewer-independent and stays cacheable.
 * - `/workspace`: `workspaceTabCompatibilityRedirectHref` (308 to the canonical destination)
 *
 * Unrecognized `tab` values are ignored on `/` (home stays put) or fall back
 * to overview on `/workspace`. There is no sunset date; redirects stay until traffic
 * metrics justify removal.
 */
function resolveLegacyWorkspaceNavTab(
  value: string | null,
): WorkspaceNavTabId | null {
  if (!value || !workspaceNavTabIdSet.has(value)) {
    return null;
  }
  return value as WorkspaceNavTabId;
}

function workspacePathForNavTab(tab: WorkspaceNavTabId) {
  if (tab === "overview") return "/";
  return tab === WORKSPACE_SUBSCRIPTIONS_SECTION
    ? WORKSPACE_SUBSCRIPTIONS_PATH
    : `/workspace/${tab}`;
}

function appendSearch(pathname: string, query: URLSearchParams) {
  const search = query.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}

function queryWithoutTab(url: URL) {
  const query = new URLSearchParams(url.searchParams);
  query.delete("tab");
  return query;
}

export function isWorkspaceTab(
  value: string | null | undefined,
): value is WorkspaceTabId {
  return Boolean(value && workspaceTabIdSet.has(value));
}

export function isWorkspaceNavTab(
  value: string | null | undefined,
): value is WorkspaceNavTabId {
  return Boolean(value && workspaceNavTabIdSet.has(value));
}

export function workspaceTabHref(
  id: WorkspaceNavTabId,
  params: Record<string, string | number | null | undefined> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  return appendSearch(workspacePathForNavTab(id), query);
}

export function homeTabCompatibilityRedirectHref(url: URL) {
  const tab = url.searchParams.get("tab");
  if (!tab || !legacyHomeTabIdSet.has(tab)) return null;

  const pathname =
    tab === "bus" || tab === "links"
      ? `/catalog/${tab}`
      : workspacePathForNavTab(tab as WorkspaceNavTabId);
  return appendSearch(pathname, queryWithoutTab(url));
}

export function workspaceTabCompatibilityRedirectHref(
  url: URL,
  method = "GET",
) {
  if (
    (method !== "GET" && method !== "HEAD") ||
    url.pathname !== "/workspace"
  ) {
    return null;
  }
  const tab =
    resolveLegacyWorkspaceNavTab(url.searchParams.get("tab")) ?? "overview";
  return appendSearch(workspacePathForNavTab(tab), queryWithoutTab(url));
}
