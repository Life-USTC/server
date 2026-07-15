<script lang="ts" module>
export type CatalogActiveFilter = {
  href: string;
  label: string;
};

export type CatalogHiddenFilter = {
  name: string;
  value: string;
};
</script>

<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import XIcon from "@lucide/svelte/icons/x";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Sheet from "$lib/components/ui/sheet/index.js";

export let activeFilters: CatalogActiveFilter[] = [];
export let clearHref: string;
export let clearLabel: string;
export let filterTitle: string;
export let hiddenFilters: CatalogHiddenFilter[] = [];
export let open = false;
export let searchId: string;
export let searchLabel: string;
export let searchPlaceholder: string;
export let searchValue: string;
</script>

<div
  class="grid gap-3 border-b bg-background px-4 py-3 sm:px-5 lg:hidden"
  data-testid="catalog-mobile-filters"
>
  <div class="flex min-w-0 items-end gap-2">
    <form class="flex min-w-0 flex-1 items-end gap-2" method="GET">
      <label class="sr-only" for={searchId}>{searchLabel}</label>
      <div class="relative min-w-0 flex-1">
        <SearchIcon
          aria-hidden="true"
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          class="h-9 pl-9"
          id={searchId}
          name="search"
          placeholder={searchPlaceholder}
          type="search"
          value={searchValue}
          oninput={(event: Event) => {
            searchValue = (event.currentTarget as HTMLInputElement).value;
          }}
        />
      </div>
      {#each hiddenFilters as filter}
        {#if filter.value}
          <input name={filter.name} type="hidden" value={filter.value} />
        {/if}
      {/each}
      <Button class="h-9" type="submit">{searchLabel}</Button>
    </form>

    <Sheet.Root bind:open>
      <Sheet.Trigger>
        {#snippet child({ props })}
          <Button
            aria-label={filterTitle}
            class="relative h-9"
            type="button"
            variant="outline"
            {...props}
          >
            <SlidersHorizontalIcon aria-hidden="true" />
            <span class="hidden min-[360px]:inline">{filterTitle}</span>
            {#if activeFilters.length > 0}
              <Badge class="ml-0.5 px-1.5" variant="secondary">{activeFilters.length}</Badge>
            {/if}
          </Button>
        {/snippet}
      </Sheet.Trigger>
      <Sheet.Content class="w-[min(22rem,calc(100%-1rem))] overflow-y-auto p-0" side="right">
        <Sheet.Header class="border-b pr-12">
          <Sheet.Title>{filterTitle}</Sheet.Title>
          <Sheet.Description class="sr-only">{filterTitle}</Sheet.Description>
        </Sheet.Header>
        <div class="p-4">
          <slot />
        </div>
      </Sheet.Content>
    </Sheet.Root>
  </div>

  {#if activeFilters.length > 0}
    <div
      aria-label={filterTitle}
      class="flex flex-wrap items-center gap-1.5"
      data-testid="catalog-active-filters"
    >
      {#each activeFilters as filter}
        <Button href={filter.href} size="sm" variant="secondary">
          <span class="max-w-52 truncate">{filter.label}</span>
          <XIcon aria-hidden="true" data-icon="inline-end" />
          <span class="sr-only">{clearLabel}</span>
        </Button>
      {/each}
      {#if activeFilters.length > 1}
        <Button href={clearHref} size="sm" variant="ghost">{clearLabel}</Button>
      {/if}
    </div>
  {/if}
</div>
