<script lang="ts" generics="Row extends { jwId: string | number }, Data extends { sectionsPagination: { page: number; totalPages: number } }">
import type { Snippet } from "svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import {
  createEndlessList,
  type EndlessScrollLabels,
} from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";

let {
  data,
  rows,
  title,
  description,
  labels,
  emptyTitle,
  emptyDescription,
  card,
  table,
}: {
  data: Data;
  rows: (value: Data) => Row[];
  title: string;
  description: string;
  labels: EndlessScrollLabels;
  emptyTitle?: string;
  emptyDescription: string;
  card: Snippet<[Row]>;
  table: Snippet<[Row[], (section: Row) => string]>;
} = $props();

const state = createEndlessList({
  source: () => data,
  select: (value) => ({ items: rows(value), ...value.sectionsPagination }),
  key: (row) => row.jwId,
  pageHref: (next) => {
    const params = new URLSearchParams(page.url.search);
    params.set("sectionsPage", String(next));
    return `${page.url.pathname}?${params}`;
  },
});
const href = (section: Row) => `/catalog/sections/${section.jwId}`;
</script>

<section id="sections" data-detail-tab="sections" class="scroll-mt-4">
  <h2 class="mb-3 section-heading">{title}</h2>
  <p class="mb-4 text-sm text-muted-foreground">{description}</p>
  <div class="grid gap-4" data-testid="section-history">
    {#if state.items.length}
      <ResponsiveCollection>
        {#snippet mobile()}
          <Item.Group class="min-w-0">
            {#each state.items as section}
              <MobileListCard variant="outline" href={href(section)}>{@render card(section)}</MobileListCard>
            {/each}
          </Item.Group>
        {/snippet}
        {#snippet desktop()}
          <div class="min-w-0">
            {@render table(state.items, href)}
          </div>
        {/snippet}
      </ResponsiveCollection>
    {:else}
      <div class="min-w-0"><CollectionEmpty variant="compact" title={emptyTitle} description={emptyDescription} /></div>
    {/if}
    <EndlessScroll {state} {labels} />
  </div>
</section>
