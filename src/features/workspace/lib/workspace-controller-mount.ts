import { getLocalStorageItem } from "@/lib/browser/local-storage";
import { mountPageSearchShortcut } from "@/lib/browser/page-search-shortcut";
import {
  WORKSPACE_VIEW_STORAGE_KEY,
  workspaceViewsFromPreference,
} from "./view-preferences";
import type { WorkspaceViewState } from "./workspace-controller-helpers";
import { currentCatalogLinkReturnTo } from "./workspace-link-ui";

type WorkspaceMountCopy = {
  workspace: {
    linkHub: {
      pinFailedDescription: string;
    };
  };
};

export function mountWorkspaceController(input: {
  applyViewState: (state: WorkspaceViewState) => void;
  clearPendingRemoveSection: () => void;
  copy: WorkspaceMountCopy;
  getLinkSearchInput: () => HTMLInputElement | null;
  replaceState: (href: string) => void;
  setLinkActionError: (value: string) => void;
  setLinkReturnTo: (value: string) => void;
}) {
  const url = new URL(window.location.href);
  input.setLinkReturnTo(currentCatalogLinkReturnTo());

  if (url.searchParams.get("workspaceLinkPinError") === "1") {
    input.setLinkActionError(input.copy.workspace.linkHub.pinFailedDescription);
    url.searchParams.delete("workspaceLinkPinError");
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    input.replaceState(nextHref);
    input.setLinkReturnTo(nextHref);
  }

  input.applyViewState(
    workspaceViewsFromPreference(
      url,
      getLocalStorageItem(WORKSPACE_VIEW_STORAGE_KEY),
    ),
  );

  const unmountPageSearchShortcut = mountPageSearchShortcut(() =>
    input.getLinkSearchInput(),
  );
  return () => {
    unmountPageSearchShortcut();
    input.clearPendingRemoveSection();
  };
}
