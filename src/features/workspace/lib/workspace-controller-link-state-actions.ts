import type {
  CatalogLinkItem,
  LinkView,
  WorkspaceViewState,
} from "./workspace-controller-helpers";
import { submitWorkspaceLinkPinChange } from "./workspace-controller-link-actions";
import { catalogLinkViewChange } from "./workspace-controller-view-actions";

type LinkActionsCopy = {
  linkHub: {
    pinFailedDescription: string;
    pin: string;
    unpin: string;
  };
};

export function createWorkspaceLinkStateActions(input: {
  applyWorkspaceViewState: (state: WorkspaceViewState) => void;
  getWorkspaceCopy: () => LinkActionsCopy;
  getCatalogLinkItems: () => CatalogLinkItem[];
  getLinkReturnTo: () => string;
  getOverviewLinkItems: () => CatalogLinkItem[];
  getUpdatingCatalogLinkSlug: () => string | null;
  onSuccess?: (action: "pin" | "unpin") => void;
  replaceState: (href: string) => void;
  setCatalogLinkItems: (value: CatalogLinkItem[]) => void;
  setLinkActionError: (value: string) => void;
  setLinkReturnTo: (value: string) => void;
  setOverviewLinkItems: (value: CatalogLinkItem[]) => void;
  setUpdatingCatalogLinkSlug: (value: string | null) => void;
}) {
  async function submitWorkspaceLinkPin(slug: string, action: "pin" | "unpin") {
    if (input.getUpdatingCatalogLinkSlug()) return;
    input.setUpdatingCatalogLinkSlug(slug);
    input.setLinkActionError("");

    try {
      const next = await submitWorkspaceLinkPinChange({
        action,
        catalogLinkItems: input.getCatalogLinkItems(),
        fallbackMessage: input.getWorkspaceCopy().linkHub.pinFailedDescription,
        overviewLinkItems: input.getOverviewLinkItems(),
        returnTo: input.getLinkReturnTo(),
        slug,
      });

      input.setCatalogLinkItems(next.catalogLinkItems);
      input.setOverviewLinkItems(next.overviewLinkItems);
      input.onSuccess?.(action);
    } catch (error) {
      input.setLinkActionError(error instanceof Error ? error.message : "");
    } finally {
      input.setUpdatingCatalogLinkSlug(null);
    }
  }

  function setLinkView(mode: LinkView) {
    const next = catalogLinkViewChange(mode);
    input.applyWorkspaceViewState(next.state);
    input.replaceState(next.href);
    input.setLinkReturnTo(next.href);
  }

  return {
    setLinkView,
    submitWorkspaceLinkPin,
  };
}
