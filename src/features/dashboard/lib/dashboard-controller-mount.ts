import type { DashboardViewState } from "./dashboard-controller-helpers";
import { currentDashboardLinkReturnTo } from "./dashboard-link-ui";
import { formatMessage } from "./overview";
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
  subscriptions: {
    bulkImport: {
      successDescription: string;
    };
    optOutSuccessDescription: string;
  };
};

export function mountDashboardController(input: {
  applyViewState: (state: DashboardViewState) => void;
  clearPendingRemoveSection: () => void;
  copy: DashboardMountCopy;
  getLinkSearchInput: () => HTMLInputElement | null;
  replaceState: (href: string) => void;
  setBulkImportMessage: (value: string) => void;
  setLinkActionError: (value: string) => void;
  setLinkReturnTo: (value: string) => void;
  setSubscriptionActionMessage: (value: string) => void;
}) {
  const url = new URL(window.location.href);
  input.setLinkReturnTo(currentDashboardLinkReturnTo());

  const importedCount = url.searchParams.get("imported");
  if (importedCount) {
    input.setBulkImportMessage(
      formatMessage(input.copy.subscriptions.bulkImport.successDescription, {
        count: importedCount,
      }),
    );
  }

  if (url.searchParams.get("removed")) {
    input.setSubscriptionActionMessage(
      input.copy.subscriptions.optOutSuccessDescription,
    );
  }

  if (url.searchParams.get("dashboardLinkPinError") === "1") {
    input.setLinkActionError(input.copy.dashboard.linkHub.pinFailedDescription);
    url.searchParams.delete("dashboardLinkPinError");
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    input.replaceState(nextHref);
    input.setLinkReturnTo(nextHref);
  }

  input.applyViewState(
    dashboardViewsFromPreference(
      url,
      localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY),
    ),
  );

  function handleShortcut(event: KeyboardEvent) {
    const linkSearchInput = input.getLinkSearchInput();
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k" &&
      linkSearchInput
    ) {
      event.preventDefault();
      linkSearchInput.focus();
    }
  }

  window.addEventListener("keydown", handleShortcut);
  return () => {
    window.removeEventListener("keydown", handleShortcut);
    input.clearPendingRemoveSection();
  };
}
