import { semanticSectionCompatibilityHref } from "@/lib/navigation/semantic-section-redirect";

export const signedTabIds = [
  "overview",
  "calendar",
  "homeworks",
  "todos",
  "exams",
  "subscriptions",
  "bus",
  "links",
] as const;

export type SignedTabId = (typeof signedTabIds)[number];

const signedTabIdSet = new Set<string>(signedTabIds);
const homeDashboardQueryKeys = new Set([
  "calendarMonth",
  "calendarSemester",
  "calendarView",
  "calendarWeek",
  "dashboardLinkPinError",
  "examView",
  "homeworkView",
  "imported",
  "linkView",
  "overviewWeek",
  "removed",
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

export function isSignedDashboardTab(
  value: string | null | undefined,
): value is SignedTabId {
  return Boolean(value && signedTabIdSet.has(value));
}

export function dashboardTabHref(
  id: SignedTabId,
  params: Record<string, string | number | null | undefined> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const search = query.toString();
  const path = `/dashboard/${id}`;
  return `${path}${search ? `?${search}` : ""}`;
}

export function dashboardRedirectHrefFromHome(url: URL) {
  const query = new URLSearchParams();
  const tab = url.searchParams.get("tab");

  for (const [key, value] of url.searchParams) {
    if (homeDashboardQueryKeys.has(key)) {
      query.append(key, value);
    }
  }

  return appendSearch(
    isSignedDashboardTab(tab) ? `/dashboard/${tab}` : "/dashboard/overview",
    query,
  );
}

export function homeTabCompatibilityRedirectHref(url: URL, signedIn: boolean) {
  const tab = url.searchParams.get("tab");
  if (!isSignedDashboardTab(tab)) return null;

  const pathname =
    signedIn || (tab !== "bus" && tab !== "links")
      ? `/dashboard/${tab}`
      : `/${tab}`;
  return appendSearch(pathname, queryWithoutTab(url));
}

export function dashboardTabCompatibilityRedirectHref(
  url: URL,
  method = "GET",
) {
  return semanticSectionCompatibilityHref({
    basePath: "/dashboard",
    defaultSection: "overview",
    method,
    resolveSection: (tab) => (isSignedDashboardTab(tab) ? tab : null),
    url,
  });
}
