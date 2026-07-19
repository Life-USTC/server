import {
  resolveDashboardLinkBySlug,
  updateDashboardLinkPinState,
} from "./dashboard-link-service";

export type DashboardLinkPinBatchItem = {
  action: "pin" | "unpin";
  slug: string;
};

export async function setDashboardLinkPinStatesBatch(input: {
  items: readonly DashboardLinkPinBatchItem[];
  userId: string;
}) {
  const items: DashboardLinkPinBatchItem[] = [];
  for (const item of input.items) {
    const link = resolveDashboardLinkBySlug(item.slug);
    if (!link) {
      return {
        ok: false as const,
        error: "invalid_slug" as const,
        slug: item.slug.trim(),
      };
    }
    items.push({ action: item.action, slug: link.slug });
  }

  let pinnedSlugs: string[] = [];
  for (const item of items) {
    pinnedSlugs = await updateDashboardLinkPinState({
      action: item.action,
      slug: item.slug,
      userId: input.userId,
    });
  }

  return { ok: true as const, pinnedSlugs };
}
