import type { CatalogLinkItem } from "./dashboard-controller-helpers";
import {
  applyDashboardLinkPinnedSlugs,
  submitDashboardLinkPinRequest,
} from "./dashboard-link-ui";

export async function submitDashboardLinkPinChange(input: {
  action: "pin" | "unpin";
  dashboardLinkItems: CatalogLinkItem[];
  fallbackMessage: string;
  overviewLinkItems: CatalogLinkItem[];
  returnTo: string;
  slug: string;
}) {
  try {
    const pinnedSlugs = await submitDashboardLinkPinRequest({
      action: input.action,
      fallbackMessage: input.fallbackMessage,
      returnTo: input.returnTo,
      slug: input.slug,
    });

    return {
      dashboardLinkItems: applyDashboardLinkPinnedSlugs(
        input.dashboardLinkItems,
        pinnedSlugs,
      ),
      overviewLinkItems: applyDashboardLinkPinnedSlugs(
        input.overviewLinkItems,
        pinnedSlugs,
      ),
    };
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : input.fallbackMessage,
    );
  }
}
