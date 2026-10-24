<script lang="ts">
import type { Snippet } from "svelte";
import ActiveFilters from "#lib/components/ActiveFilters.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { Button } from "#lib/components/ui/button/index.js";

let {
  activeFilters = [],
  clearHref,
  clearLabel,
  filterTitle,
  searchLabel,
  searchPlaceholder,
  values,
  onchange,
  applyLabel,
  formId,
  children,
}: {
  activeFilters?: { href: string; label: string }[];
  clearHref: string;
  clearLabel: string;
  filterTitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  values: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  applyLabel: string;
  formId: string;
  children?: Snippet;
} = $props();
</script>

<div class="grid w-full min-w-0 gap-3" data-slot="table-filter-toolbar">
  <form id={formId} action={clearHref} method="get" class="flex min-w-0 flex-wrap items-center gap-2">
    <SearchField id={formId + "-search"} name="search" label={searchLabel} placeholder={searchPlaceholder} bind:value={() => values.search ?? "", (value) => onchange({ search: value })} />
    {#each Object.entries(values) as [name, value]}
      {#if name !== "search" && name !== "page" && value}<input type="hidden" {name} {value} />{/if}
    {/each}
    <Button type="submit">{applyLabel}</Button>
  </form>
  {#if children}<div class="flex flex-wrap items-center gap-x-4 gap-y-2">{@render children()}</div>{/if}
  <ActiveFilters items={activeFilters} ariaLabel={filterTitle} {clearHref} {clearLabel} />
</div>
