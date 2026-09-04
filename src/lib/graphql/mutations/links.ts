import { setDashboardLinkPinStatesBatch } from "@/features/dashboard-links/server/dashboard-link-pin-batch";
import {
  MAX_PINNED_LINKS,
  resolveDashboardLinkBySlug,
  updateDashboardLinkPinState,
} from "@/features/dashboard-links/server/dashboard-link-service";
import type { GraphqlContext } from "../context";
import { badMutationInput } from "../mutation-errors";
import { requireGraphqlMutation } from "../mutation-guard";
import { requireMutationBatchSize } from "../mutation-input";

type WorkspaceLinkPinBatchItemInput = {
  pinned: boolean;
  slug: string;
};

export const linkMutationResolvers = {
  async linkPinSet(
    _parent: unknown,
    args: { pinned: boolean; slug: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.link-pin",
    );
    const link = resolveDashboardLinkBySlug(args.slug);
    if (!link) badMutationInput("Unknown dashboard link slug.");

    const pinnedSlugs = await updateDashboardLinkPinState({
      action: args.pinned ? "pin" : "unpin",
      slug: link.slug,
      userId: principal.userId,
    });
    return {
      slug: link.slug,
      pinned: pinnedSlugs.includes(link.slug),
      pinnedSlugs,
      maxPinnedLinks: MAX_PINNED_LINKS,
    };
  },
  async linkPinsSet(
    _parent: unknown,
    args: { items: WorkspaceLinkPinBatchItemInput[] },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.link-pin",
      {
        rateLimitTier: "batch",
      },
    );
    requireMutationBatchSize(args.items, "items", 10);
    const items = args.items.map((item) => ({
      action: item.pinned ? ("pin" as const) : ("unpin" as const),
      slug: item.slug.trim(),
    }));
    if (items.some((item) => !item.slug)) {
      badMutationInput("slug must be non-empty.");
    }

    const result = await setDashboardLinkPinStatesBatch({
      items,
      userId: principal.userId,
    });
    if (!result.ok) {
      badMutationInput(`Unknown dashboard link slug: ${result.slug}.`);
    }
    return {
      pinnedSlugs: result.pinnedSlugs,
      maxPinnedLinks: MAX_PINNED_LINKS,
    };
  },
};
