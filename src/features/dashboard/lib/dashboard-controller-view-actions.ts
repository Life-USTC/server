import type {
  DashboardViewState,
  ExamView,
  HomeworkView,
  LinkView,
  TodoView,
} from "./dashboard-controller-helpers";
import {
  dashboardViewHref,
  dashboardViewsForCardMode,
  dashboardViewsForLinkMode,
  persistDashboardViewMode,
} from "./view-preferences";

type CardViewPreference = "examView" | "homeworkView" | "todoView";
type CardView = ExamView | HomeworkView | TodoView;

export function dashboardCardViewChange(
  preference: CardViewPreference,
  mode: CardView,
): { href: string; state: DashboardViewState } {
  persistDashboardViewMode(mode);
  return {
    href: dashboardViewHref(
      new URL(window.location.href),
      preference,
      mode === "list",
    ),
    state: dashboardViewsForCardMode(mode),
  };
}

export function dashboardLinkViewChange(mode: LinkView): {
  href: string;
  state: DashboardViewState;
} {
  persistDashboardViewMode(mode === "list" ? "list" : "cards");
  const href = dashboardViewHref(
    new URL(window.location.href),
    "linkView",
    mode === "list",
  );
  return {
    href,
    state: dashboardViewsForLinkMode(mode),
  };
}
