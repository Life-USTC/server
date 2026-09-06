import {
  persistWorkspaceViewMode,
  workspaceViewHref,
  workspaceViewsForCardMode,
  workspaceViewsForLinkMode,
} from "./view-preferences";
import type {
  ExamView,
  HomeworkView,
  LinkView,
  TodoView,
  WorkspaceViewState,
} from "./workspace-controller-helpers";

type CardViewPreference = "examView" | "homeworkView" | "todoView";
type CardView = ExamView | HomeworkView | TodoView;

export function workspaceCardViewChange(
  preference: CardViewPreference,
  mode: CardView,
): { href: string; state: WorkspaceViewState } {
  persistWorkspaceViewMode(mode);
  return {
    href: workspaceViewHref(
      new URL(window.location.href),
      preference,
      mode === "list",
    ),
    state: workspaceViewsForCardMode(mode),
  };
}

export function catalogLinkViewChange(mode: LinkView): {
  href: string;
  state: WorkspaceViewState;
} {
  persistWorkspaceViewMode(mode === "list" ? "list" : "cards");
  const href = workspaceViewHref(
    new URL(window.location.href),
    "linkView",
    mode === "list",
  );
  return {
    href,
    state: workspaceViewsForLinkMode(mode),
  };
}
