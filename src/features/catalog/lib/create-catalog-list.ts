import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { createFilterDraft } from "@/lib/navigation/filter-draft.svelte";
import { page } from "$app/state";
import { catalogListPageHref } from "./catalog-list-query";

export function createCatalogList<Row>(
  source: () => {
    data: Row[];
    filters: Record<string, string | null | undefined>;
    pagination: { page: number; totalPages: number };
  },
  key: (row: Row) => string | number,
) {
  const endless = createEndlessList({
    source,
    key,
    select: ({ data: items, pagination }) => ({ items, ...pagination }),
    pageHref: (next) => catalogListPageHref(new URL(page.url.href), next),
  });
  return { endless, draft: createFilterDraft(() => source().filters) };
}
