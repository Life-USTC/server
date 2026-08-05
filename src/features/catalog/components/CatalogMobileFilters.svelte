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
import { onMount } from "svelte";
import { mountPageSearchShortcut } from "@/lib/browser/page-search-shortcut";
import PageSearchShortcutHint from "$lib/components/shell/PageSearchShortcutHint.svelte";
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

let searchInput: HTMLInputElement | null = null;

onMount(() => mountPageSearchShortcut(() => searchInput));
</script>

<div
  class={cn(
    "grid gap-3",
    inlineFilters && "xl:flex xl:flex-wrap xl:items-end",
  )}
  data-testid="catalog-mobile-filters"
>
  <form
    class={cn(
      "grid min-w-0 gap-2",
      inlineFilters
        ? "grid-cols-1 min-[420px]:grid-cols-[minmax(0,1fr)_auto]"
        : "grid-cols-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto_auto]",
      inlineFilters && "xl:min-w-0 xl:flex-1",
    )}
    method="GET"
  >
    <label class="sr-only" for={searchId}>{searchLabel}</label>
    <InputGroup.Root
      class={cn(
        inlineFilters ? "" : "col-span-2 min-[420px]:col-span-1",
      )}
    >
      <InputGroup.Addon>
        <SearchIcon aria-hidden="true" />
      </InputGroup.Addon>
      <InputGroup.Input
        id={searchId}
        bind:ref={searchInput}
        name="search"
        placeholder={searchPlaceholder}
        type="search"
        value={searchValue}
        oninput={(event: Event) => {
          searchValue = (event.currentTarget as HTMLInputElement).value;
        }}
      />
      <InputGroup.Addon align="inline-end">
        <PageSearchShortcutHint />
      </InputGroup.Addon>
    </InputGroup.Root>
    {#each hiddenFilters as filter}
      {#if filter.value}
        <input name={filter.name} type="hidden" value={filter.value} />
      {/if}
    {/each}
    <Button class="w-full min-[420px]:w-auto" type="submit">
      {searchLabel}
    </Button>

    {#if !inlineFilters}
      <Sheet.Root bind:open>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              aria-label={activeFilters.length > 0
                ? `${filterTitle} (${activeFilters.length})`
                : filterTitle}
              class={cn(
                "relative w-full min-w-0 min-[420px]:w-auto",
                typeof props.class === "string" ? props.class : undefined,
              )}
              type="button"
              variant="outline"
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
      class="xl:w-fit xl:shrink-0"
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
        inlineFilters && "xl:basis-full",
      )}
      data-testid="catalog-active-filters"
      role="group"
    >
      {#each activeFilters as filter}
        <Button
          aria-label={`${clearLabel}: ${filter.label}`}
          class="max-w-full min-w-0"
          href={filter.href}
          title={filter.label}
          variant="secondary"
        >
          <span class="min-w-0 truncate">{filter.label}</span>
          <XIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      {/each}
      {#if activeFilters.length > 1}
        <Button
          href={clearHref}
          variant="ghost"
        >
          {clearLabel}
        </Button>
      {/if}
    </div>
  {/if}
</div>
