<script lang="ts">
import type { Snippet } from "svelte";
import ActiveFilters from "$lib/components/ActiveFilters.svelte";
import FilterToolbar from "$lib/components/FilterToolbar.svelte";
import SearchField from "$lib/components/SearchField.svelte";
import { Button } from "$lib/components/ui/button";

let {
  activeFilters = [],
  clearHref,
  clearLabel,
  filterDescription,
  filterTitle,
  hiddenFilters = [],
  open = $bindable(false),
  searchId,
  searchLabel,
  searchPlaceholder,
  searchValue = $bindable(""),
  children,
}: {
  activeFilters?: { href: string; label: string }[];
  clearHref: string;
  clearLabel: string;
  filterDescription?: string;
  filterTitle: string;
  hiddenFilters?: { name: string; value: string }[];
  open?: boolean;
  searchId: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue?: string;
  children: Snippet;
} = $props();
</script>
<div class="grid min-w-0 gap-3">
  <FilterToolbar {filterTitle} {filterDescription} activeCount={activeFilters.length} bind:open>
    {#snippet primary()}
      <form method="get" class="flex min-w-0 items-end gap-2">
        <SearchField id={searchId} name="search" label={searchLabel} placeholder={searchPlaceholder} bind:value={searchValue} />
        {#each hiddenFilters as filter}{#if filter.value}<input type="hidden" name={filter.name} value={filter.value} />{/if}{/each}
        <Button type="submit" class="h-11">{searchLabel}</Button>
      </form>
    {/snippet}
    {#snippet advanced()}{@render children()}{/snippet}
  </FilterToolbar>
  <ActiveFilters items={activeFilters} ariaLabel={filterTitle} {clearHref} {clearLabel} />
</div>
