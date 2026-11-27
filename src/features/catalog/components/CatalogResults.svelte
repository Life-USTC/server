<script lang="ts" generics="Row">
import type { Snippet } from "svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filters";

let {
  rows,
  filters,
  prefix,
  testId,
  card,
  title,
  description,
  table,
}: {
  rows: Row[];
  filters: Record<string, CatalogColumnFilterProps>;
  prefix: string;
  testId?: string;
  card: Snippet<[Row]>;
  title: string;
  description: string;
  table: Snippet<[Snippet]>;
} = $props();
</script>

{#snippet empty()}
  <CollectionEmpty {title} {description} />
{/snippet}

<section class="grid min-w-0 gap-3">
  <ResponsiveCollection>
    {#snippet mobile()}
      <div class="grid gap-3" data-slot="collection-header">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          {#each Object.entries(filters) as [key, column] (key)}
            <CatalogColumnFilter {...column} idPrefix={prefix + key} />
          {/each}
        </div>
      </div>
      {#if rows.length}
        <Item.Group class="gap-0" role="list" data-testid={testId}>
          {#each rows as row, index}
            <div role="listitem" class="relative">
              {@render card(row)}
            </div>
            {#if index < rows.length - 1}
              <Item.Separator aria-hidden="true" />
            {/if}
          {/each}
        </Item.Group>
      {:else}
        {@render empty()}
      {/if}
    {/snippet}
    {#snippet desktop()}
      {@render table(empty)}
    {/snippet}
  </ResponsiveCollection>
</section>
