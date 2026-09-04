import { getLocalStorageItem } from "@/lib/browser/local-storage";
import { mountPageSearchShortcut } from "@/lib/browser/page-search-shortcut";
import type { DashboardViewState } from "./dashboard-controller-helpers";
import { currentDashboardLinkReturnTo } from "./dashboard-link-ui";
import {
  DASHBOARD_VIEW_STORAGE_KEY,
  dashboardViewsFromPreference,
} from "./view-preferences";

type DashboardMountCopy = {
  dashboard: {
    linkHub: {
      pinFailedDescription: string;
    };
  };
};

export function mountDashboardController(input: {
  applyViewState: (state: DashboardViewState) => void;
  clearPendingRemoveSection: () => void;
  copy: DashboardMountCopy;
  getLinkSearchInput: () => HTMLInputElement | null;
  replaceState: (href: string) => void;
  setLinkActionError: (value: string) => void;
  setLinkReturnTo: (value: string) => void;
}) {
  const url = new URL(window.location.href);
  input.setLinkReturnTo(currentDashboardLinkReturnTo());

  if (url.searchParams.get("workspaceLinkPinError") === "1") {
    input.setLinkActionError(input.copy.dashboard.linkHub.pinFailedDescription);
    url.searchParams.delete("workspaceLinkPinError");
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    input.replaceState(nextHref);
    input.setLinkReturnTo(nextHref);
  }

  input.applyViewState(
    dashboardViewsFromPreference(
      url,
      getLocalStorageItem(DASHBOARD_VIEW_STORAGE_KEY),
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
