import {
  persistWorkspaceViewMode,
  workspaceViewHref,
  workspaceViewsForLinkMode,
} from "./view-preferences";
import type {
  LinkView,
  WorkspaceViewState,
} from "./workspace-controller-helpers";

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
