import { setLocalStorageItem } from "@/lib/browser/local-storage";

export type WorkspaceCardView = "cards" | "list";
export type CatalogLinkView = "grid" | "list";

export type WorkspaceViewState = {
  homeworkView: WorkspaceCardView;
  todoView: WorkspaceCardView;
  examView: WorkspaceCardView;
  linkView: CatalogLinkView;
};

export const WORKSPACE_VIEW_STORAGE_KEY = "life-ustc-workspace-view-mode";

export function workspaceViewsForCardMode(
  mode: WorkspaceCardView,
): WorkspaceViewState {
  return {
    homeworkView: mode,
    todoView: mode,
    examView: mode,
    linkView: mode === "list" ? "list" : "grid",
  };
}

export function workspaceViewsForLinkMode(
  mode: CatalogLinkView,
): WorkspaceViewState {
  const cardMode = mode === "list" ? "list" : "cards";
  return {
    homeworkView: cardMode,
    todoView: cardMode,
    examView: cardMode,
    linkView: mode,
  };
}

export function workspaceViewsFromPreference(
  _url: URL,
  _storedView: string | null,
): WorkspaceViewState {
  // Task tabs always use open list on desktop / cards on mobile.
  // Keep returning "list" so legacy ?todoView=list URLs stay coherent.
  return workspaceViewsForCardMode("list");
}

export function persistWorkspaceViewMode(mode: WorkspaceCardView) {
  setLocalStorageItem(WORKSPACE_VIEW_STORAGE_KEY, mode);
}

export function workspaceViewHref(
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
