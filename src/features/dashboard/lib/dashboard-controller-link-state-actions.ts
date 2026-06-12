import type {
  DashboardLinkItem,
  DashboardViewState,
  LinkView,
} from "./dashboard-controller-helpers";
import { submitDashboardLinkPinChange } from "./dashboard-controller-link-actions";
import { dashboardLinkViewChange } from "./dashboard-controller-view-actions";

type LinkActionsCopy = {
  linkHub: {
    pinFailedDescription: string;
  };
};

export function createDashboardLinkStateActions(input: {
  applyDashboardViewState: (state: DashboardViewState) => void;
  getDashboardCopy: () => LinkActionsCopy;
  getDashboardLinkItems: () => DashboardLinkItem[];
  getLinkReturnTo: () => string;
  getOverviewLinkItems: () => DashboardLinkItem[];
  getUpdatingDashboardLinkSlug: () => string | null;
  replaceState: (href: string) => void;
  setDashboardLinkItems: (value: DashboardLinkItem[]) => void;
  setLinkActionError: (value: string) => void;
  setLinkReturnTo: (value: string) => void;
  setOverviewLinkItems: (value: DashboardLinkItem[]) => void;
  setUpdatingDashboardLinkSlug: (value: string | null) => void;
}) {
  async function submitDashboardLinkPin(slug: string, action: "pin" | "unpin") {
    if (input.getUpdatingDashboardLinkSlug()) return;
    input.setUpdatingDashboardLinkSlug(slug);
    input.setLinkActionError("");

    try {
      const next = await submitDashboardLinkPinChange({
        action,
        dashboardLinkItems: input.getDashboardLinkItems(),
        fallbackMessage: input.getDashboardCopy().linkHub.pinFailedDescription,
        overviewLinkItems: input.getOverviewLinkItems(),
        returnTo: input.getLinkReturnTo(),
        slug,
      });

      input.setDashboardLinkItems(next.dashboardLinkItems);
      input.setOverviewLinkItems(next.overviewLinkItems);
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
