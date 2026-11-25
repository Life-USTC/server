import type { CatalogLinkItem } from "./workspace-controller-helpers";
import { submitWorkspaceLinkPinChange } from "./workspace-controller-link-actions";

type LinkActionsCopy = {
  linkHub: {
    pinFailedDescription: string;
    pin: string;
    unpin: string;
  };
};

export function createWorkspaceLinkStateActions(input: {
  getWorkspaceCopy: () => LinkActionsCopy;
  getCatalogLinkItems: () => CatalogLinkItem[];
  getLinkReturnTo: () => string;
  getUpdatingCatalogLinkSlug: () => string | null;
  onSuccess?: (action: "pin" | "unpin") => void;
  setCatalogLinkItems: (value: CatalogLinkItem[]) => void;
  setLinkActionError: (value: string) => void;
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
        returnTo: input.getLinkReturnTo(),
        slug,
      });

      input.setCatalogLinkItems(next.catalogLinkItems);
      input.onSuccess?.(action);
    } catch (error) {
      input.setLinkActionError(error instanceof Error ? error.message : "");
    } finally {
      input.setUpdatingCatalogLinkSlug(null);
    }
  }

  return {
    submitWorkspaceLinkPin,
  };
}
