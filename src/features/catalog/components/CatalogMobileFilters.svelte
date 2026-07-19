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
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import * as Sheet from "$lib/components/ui/sheet/index.js";
import { cn } from "$lib/utils.js";

export let activeFilters: CatalogActiveFilter[] = [];
export let clearHref: string;
export let clearLabel: string;
export let filterDescription = "";
export let filterTitle: string;
export let hiddenFilters: CatalogHiddenFilter[] = [];
export let inlineFilters = false;
export let open = false;
export let searchId: string;
export let searchLabel: string;
export let searchPlaceholder: string;
export let searchValue: string;
</script>

<div
  class={cn(
    "grid gap-3 rounded-xl border bg-card px-3 py-3 sm:px-4",
    inlineFilters &&
      "xl:grid-cols-[minmax(16rem,2fr)_minmax(28rem,3fr)] xl:items-end",
  )}
  data-testid="catalog-mobile-filters"
>
  <form
    class={cn(
      "grid min-w-0 gap-2",
      inlineFilters
        ? "grid-cols-[minmax(0,1fr)_auto]"
        : "grid-cols-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto_auto]",
    )}
    method="GET"
  >
    <label class="sr-only" for={searchId}>{searchLabel}</label>
    <InputGroup.Root
      class={cn(
        "h-11",
        inlineFilters ? "" : "col-span-2 min-[420px]:col-span-1",
      )}
    >
      <InputGroup.Addon>
        <SearchIcon aria-hidden="true" />
      </InputGroup.Addon>
      <InputGroup.Input
          id={searchId}
          name="search"
          placeholder={searchPlaceholder}
          type="search"
          value={searchValue}
          oninput={(event: Event) => {
            searchValue = (event.currentTarget as HTMLInputElement).value;
          }}
        />
    </InputGroup.Root>
    {#each hiddenFilters as filter}
      {#if filter.value}
        <input name={filter.name} type="hidden" value={filter.value} />
      {/if}
    {/each}
    <Button class="h-11 w-full min-[420px]:w-auto" type="submit">
      {searchLabel}
    </Button>

    {#if !inlineFilters}
      <Sheet.Root bind:open>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <Button
              aria-label={activeFilters.length > 0
                ? `${filterTitle} (${activeFilters.length})`
                : filterTitle}
              class="relative h-11 w-full min-w-0 min-[420px]:w-auto"
              type="button"
              variant="outline"
              {...props}
            >
              <SlidersHorizontalIcon aria-hidden="true" data-icon="inline-start" />
              <span class="min-w-0 truncate">{filterTitle}</span>
              {#if activeFilters.length > 0}
                <Badge class="ml-0.5 px-1.5" variant="secondary">{activeFilters.length}</Badge>
              {/if}
            </Button>
          {/snippet}
        </Sheet.Trigger>
        <Sheet.Content
          class="overflow-hidden p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-lg"
          side="right"
        >
          <Sheet.Header class="shrink-0 border-b pr-12">
            <Sheet.Title>{filterTitle}</Sheet.Title>
            {#if filterDescription}
              <Sheet.Description>{filterDescription}</Sheet.Description>
            {:else}
              <Sheet.Description class="sr-only">{filterTitle}</Sheet.Description>
            {/if}
          </Sheet.Header>
          <div class="min-h-0 flex-1 overflow-y-auto p-4">
            <slot />
          </div>
        </Sheet.Content>
      </Sheet.Root>
    {/if}
  </form>

  {#if inlineFilters}
    <Separator class="xl:hidden" />
    <div
      aria-label={filterTitle}
      data-testid="catalog-inline-filters"
      role="group"
    >
      <slot />
    </div>
  {/if}

  {#if activeFilters.length > 0}
    <div
      aria-label={filterTitle}
      class={cn(
        "flex flex-wrap items-center gap-1.5",
        inlineFilters && "xl:col-span-2",
      )}
      data-testid="catalog-active-filters"
      role="group"
    >
      {#each activeFilters as filter}
        <Button
          aria-label={`${clearLabel}: ${filter.label}`}
          class="min-h-11 max-w-full min-w-0 sm:min-h-8"
          href={filter.href}
          size="sm"
          title={filter.label}
          variant="secondary"
        >
          <span class="min-w-0 truncate">{filter.label}</span>
          <XIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      {/each}
      {#if activeFilters.length > 1}
        <Button
          class="min-h-11 sm:min-h-8"
          href={clearHref}
          size="sm"
          variant="ghost"
        >
          {clearLabel}
        </Button>
      {/if}
    </div>
  {/if}
</div>
