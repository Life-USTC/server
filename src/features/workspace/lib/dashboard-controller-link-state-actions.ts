import type {
  CatalogLinkItem,
  DashboardViewState,
  LinkView,
} from "./dashboard-controller-helpers";
import { submitDashboardLinkPinChange } from "./dashboard-controller-link-actions";
import { dashboardLinkViewChange } from "./dashboard-controller-view-actions";

type LinkActionsCopy = {
  linkHub: {
    pinFailedDescription: string;
    pin: string;
    unpin: string;
  };
};

export function createDashboardLinkStateActions(input: {
  applyDashboardViewState: (state: DashboardViewState) => void;
  getDashboardCopy: () => LinkActionsCopy;
  getCatalogLinkItems: () => CatalogLinkItem[];
  getLinkReturnTo: () => string;
  getOverviewLinkItems: () => CatalogLinkItem[];
  getUpdatingDashboardLinkSlug: () => string | null;
  onSuccess?: (action: "pin" | "unpin") => void;
  replaceState: (href: string) => void;
  setCatalogLinkItems: (value: CatalogLinkItem[]) => void;
  setLinkActionError: (value: string) => void;
  setLinkReturnTo: (value: string) => void;
  setOverviewLinkItems: (value: CatalogLinkItem[]) => void;
  setUpdatingDashboardLinkSlug: (value: string | null) => void;
}) {
  async function submitDashboardLinkPin(slug: string, action: "pin" | "unpin") {
    if (input.getUpdatingDashboardLinkSlug()) return;
    input.setUpdatingDashboardLinkSlug(slug);
    input.setLinkActionError("");

    try {
      const next = await submitDashboardLinkPinChange({
        action,
        dashboardLinkItems: input.getCatalogLinkItems(),
        fallbackMessage: input.getDashboardCopy().linkHub.pinFailedDescription,
        overviewLinkItems: input.getOverviewLinkItems(),
        returnTo: input.getLinkReturnTo(),
        slug,
      });

      input.setCatalogLinkItems(next.dashboardLinkItems);
      input.setOverviewLinkItems(next.overviewLinkItems);
      input.onSuccess?.(action);
    } catch (error) {
      input.setLinkActionError(error instanceof Error ? error.message : "");
    } finally {
      input.setUpdatingDashboardLinkSlug(null);
    }
  }

  function setLinkView(mode: LinkView) {
    const next = dashboardLinkViewChange(mode);
    input.applyDashboardViewState(next.state);
    input.replaceState(next.href);
    input.setLinkReturnTo(next.href);
  }

  return {
    setLinkView,
    submitDashboardLinkPin,
  };
}
