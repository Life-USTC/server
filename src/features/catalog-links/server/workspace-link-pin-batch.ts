import {
  resolveCatalogLinkBySlug,
  updateWorkspaceLinkPinState,
} from "./catalog-link-service";

export type WorkspaceLinkPinBatchItem = {
  action: "pin" | "unpin";
  slug: string;
};

export async function setWorkspaceLinkPinStatesBatch(input: {
  items: readonly WorkspaceLinkPinBatchItem[];
  userId: string;
}) {
  const items: WorkspaceLinkPinBatchItem[] = [];
  for (const item of input.items) {
    const link = resolveCatalogLinkBySlug(item.slug);
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
    pinnedSlugs = await updateWorkspaceLinkPinState({
      action: item.action,
      slug: item.slug,
      userId: input.userId,
    });
  }

  return { ok: true as const, pinnedSlugs };
}
