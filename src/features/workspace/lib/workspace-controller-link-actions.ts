import type { CatalogLinkItem } from "./workspace-controller-helpers";
import {
  applyCatalogLinkPinnedSlugs,
  submitWorkspaceLinkPinRequest,
} from "./workspace-link-ui";

export async function submitWorkspaceLinkPinChange(input: {
  action: "pin" | "unpin";
  catalogLinkItems: CatalogLinkItem[];
  fallbackMessage: string;
  overviewLinkItems: CatalogLinkItem[];
  returnTo: string;
  slug: string;
}) {
  try {
    const pinnedSlugs = await submitWorkspaceLinkPinRequest({
      action: input.action,
      fallbackMessage: input.fallbackMessage,
      returnTo: input.returnTo,
      slug: input.slug,
    });

    return {
      catalogLinkItems: applyCatalogLinkPinnedSlugs(
        input.catalogLinkItems,
        pinnedSlugs,
      ),
      overviewLinkItems: applyCatalogLinkPinnedSlugs(
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
