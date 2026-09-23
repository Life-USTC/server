import { semanticSectionCompatibilityHref } from "@/lib/navigation/semantic-section-redirect";

export const workspaceTabIds = [
  "overview",
  "calendar",
  "homeworks",
  "todos",
  "exams",
  "subscriptions",
] as const;

export type WorkspaceTabId = (typeof workspaceTabIds)[number];

const workspaceTabIdSet = new Set<string>(workspaceTabIds);
const legacyHomeTabIdSet = new Set<string>([
  ...workspaceTabIds,
  "bus",
  "links",
]);
const homeWorkspaceQueryKeys = new Set([
  "calendarMonth",
  "calendarSemester",
  "calendarView",
  "calendarWeek",
  "workspaceLinkPinError",
  "examView",
  "homeworkView",
  "linkView",
  "overviewWeek",
  "snapshotAt",
  "todoView",
]);

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

export function workspaceTabHref(
  id: WorkspaceTabId,
  params: Record<string, string | number | null | undefined> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const search = query.toString();
  return `/workspace/${id}${search ? `?${search}` : ""}`;
}

export function workspaceRedirectHrefFromHome(url: URL) {
  const query = new URLSearchParams();
  const tab = url.searchParams.get("tab");

  for (const [key, value] of url.searchParams) {
    if (homeWorkspaceQueryKeys.has(key)) {
      query.append(key, value);
    }
  }

  return appendSearch(
    isWorkspaceTab(tab) ? `/workspace/${tab}` : "/workspace/overview",
    query,
  );
}

export function homeTabCompatibilityRedirectHref(url: URL, _signedIn: boolean) {
  const tab = url.searchParams.get("tab");
  if (!tab || !legacyHomeTabIdSet.has(tab)) return null;

  const pathname =
    tab === "bus" || tab === "links" ? `/catalog/${tab}` : `/workspace/${tab}`;
  return appendSearch(pathname, queryWithoutTab(url));
}

export function workspaceTabCompatibilityRedirectHref(
  url: URL,
  method = "GET",
) {
  return semanticSectionCompatibilityHref({
    basePath: "/workspace",
    defaultSection: "overview",
    method,
    resolveSection: (tab) => (isWorkspaceTab(tab) ? tab : null),
    url,
  });
}
