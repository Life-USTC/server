export type DashboardCardView = "cards" | "list";
export type DashboardLinkView = "grid" | "list";

export type DashboardViewState = {
  homeworkView: DashboardCardView;
  todoView: DashboardCardView;
  examView: DashboardCardView;
  linkView: DashboardLinkView;
};

export const DASHBOARD_VIEW_STORAGE_KEY = "life-ustc-dashboard-view-mode";

export function dashboardViewsForCardMode(
  mode: DashboardCardView,
): DashboardViewState {
  return {
    homeworkView: mode,
    todoView: mode,
    examView: mode,
    linkView: mode === "list" ? "list" : "grid",
  };
}

export function dashboardViewsForLinkMode(
  mode: DashboardLinkView,
): DashboardViewState {
  const cardMode = mode === "list" ? "list" : "cards";
  return {
    homeworkView: cardMode,
    todoView: cardMode,
    examView: cardMode,
    linkView: mode,
  };
}

export function dashboardViewsFromPreference(
  url: URL,
  storedView: string | null,
): DashboardViewState {
  const prefersList =
    url.searchParams.get("homeworkView") === "list" ||
    url.searchParams.get("todoView") === "list" ||
    url.searchParams.get("examView") === "list" ||
    url.searchParams.get("linkView") === "list" ||
    storedView === "list";
  return prefersList
    ? dashboardViewsForCardMode("list")
    : dashboardViewsForCardMode("cards");
}

export function persistDashboardViewMode(mode: DashboardCardView) {
  localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, mode);
}

export function dashboardViewHref(
  url: URL,
  paramName: "homeworkView" | "todoView" | "examView" | "linkView",
  isList: boolean,
) {
  if (isList) {
    url.searchParams.set(paramName, "list");
  } else {
    url.searchParams.delete(paramName);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
