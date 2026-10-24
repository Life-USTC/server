<script lang="ts">
import type { Snippet } from "svelte";
import ActiveFilters from "#lib/components/ActiveFilters.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";

let {
  activeFilters = [],
  clearHref,
  clearLabel,
  filterTitle,
  hiddenFilters = [],
  searchId,
  searchLabel,
  searchPlaceholder,
  searchValue = $bindable(""),
  children,
}: {
  activeFilters?: { href: string; label: string }[];
  clearHref: string;
  clearLabel: string;
  filterTitle: string;
  hiddenFilters?: { name: string; value: string }[];
  searchId: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue?: string;
  children?: Snippet;
} = $props();
</script>
<div class="grid w-full min-w-0 gap-3">
  <div class="flex min-w-0 flex-wrap items-center gap-2">
      <form method="get" class="flex w-full min-w-0 flex-none items-center gap-2 xl:w-auto xl:flex-1">
        <SearchField id={searchId} name="search" label={searchLabel} placeholder={searchPlaceholder} bind:value={searchValue} />
        {#each hiddenFilters as filter}{#if filter.value}<input type="hidden" name={filter.name} value={filter.value} />{/if}{/each}
        <Button type="submit" class={toolbarControlClass}>{searchLabel}</Button>
      </form>
    {@render children?.()}
  </div>
  <ActiveFilters items={activeFilters} ariaLabel={filterTitle} {clearHref} {clearLabel} />
</div>
