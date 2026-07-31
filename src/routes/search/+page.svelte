<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { afterNavigate } from "$app/navigation";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { onMount } from "svelte";
import {
  fetchGlobalSearch,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
  GLOBAL_SEARCH_PAGE_LIMIT,
} from "@/features/search/lib/global-search-client";
import {
  activeItemIdFromIndex,
  flattenSearchGroups,
  globalSearchItemDomId,
  GLOBAL_SEARCH_LISTBOX_ID,
  handleSearchListboxKeydown,
} from "@/features/search/lib/global-search-keyboard";
import type { GlobalSearchResultGroup } from "@/features/search/server/global-search-types";
import type { GlobalSearchResultItem } from "@/features/search/server/global-search-types";
import GlobalSearchResults from "$lib/components/shell/GlobalSearchResults.svelte";
import { cn } from "$lib/utils.js";
import type { PageData } from "./$types";

export let data: PageData;

let query = "";
let groups: GlobalSearchResultGroup[] = [];
let isSearching = false;
let hasSearched = false;
let searchGeneration = 0;
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let inputElement: HTMLInputElement | null = null;
let activeIndex = -1;

$: flatItems = flattenSearchGroups(groups);
$: activeItemId = activeItemIdFromIndex(flatItems, activeIndex);
$: showHint =
  query.trim().length > 0 &&
  query.trim().length < GLOBAL_SEARCH_MIN_QUERY_LENGTH;
$: showInitialHint = !hasSearched && query.trim().length === 0;
$: canNavigateResults =
  !isSearching && !showHint && !showInitialHint && flatItems.length > 0;

function resetSelection() {
  activeIndex = -1;
}

function applyQueryFromUrl(urlQuery: string, runImmediately = false) {
  query = urlQuery;
  if (urlQuery.trim().length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    if (runImmediately) {
      void runSearch();
      return;
    }
    scheduleSearch();
    return;
  }
  groups = [];
  hasSearched = false;
  isSearching = false;
  resetSelection();
}

function updateUrlQuery(nextQuery: string) {
  const url = new URL($page.url);
  const trimmed = nextQuery.trim();
  if (trimmed) {
    url.searchParams.set("q", trimmed);
  } else {
    url.searchParams.delete("q");
  }
  const nextHref = `${url.pathname}${url.search}`;
  if (nextHref !== `${$page.url.pathname}${$page.url.search}`) {
    void goto(nextHref, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });
  }
}

function scheduleSearch() {
  clearTimeout(searchDebounceTimer);
  updateUrlQuery(query);

  const trimmed = query.trim();
  if (trimmed.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    groups = [];
    hasSearched = false;
    isSearching = false;
    resetSelection();
    return;
  }

  resetSelection();
  searchDebounceTimer = setTimeout(() => {
    void runSearch();
  }, GLOBAL_SEARCH_DEBOUNCE_MS);
}

function handleQueryInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  query = input.value;
  if (event instanceof InputEvent && event.isComposing) {
    return;
  }
  scheduleSearch();
}

function handleCompositionEnd(event: CompositionEvent) {
  query = (event.currentTarget as HTMLInputElement).value;
  scheduleSearch();
}

async function runSearch() {
  const trimmed = query.trim();
  if (trimmed.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    groups = [];
    hasSearched = false;
    return;
  }

  const generation = ++searchGeneration;
  isSearching = true;
  hasSearched = true;

  try {
    const body = await fetchGlobalSearch(trimmed, GLOBAL_SEARCH_PAGE_LIMIT);
    if (generation !== searchGeneration) return;
    groups = body.groups ?? [];
  } catch {
    if (generation !== searchGeneration) return;
    groups = [];
  } finally {
    if (generation === searchGeneration) {
      isSearching = false;
    }
  }
}

function handleInputKeydown(event: KeyboardEvent) {
  handleSearchListboxKeydown({
    activeIndex,
    event,
    inputElement,
    isInteractive: canNavigateResults,
    items: flatItems,
    onActiveIndexChange: (index) => {
      activeIndex = index;
    },
    onSelect: navigateTo,
  });
}

function handleResultKeydown(event: KeyboardEvent, itemIndex: number) {
  if (itemIndex >= 0 && itemIndex !== activeIndex) {
    activeIndex = itemIndex;
  }
  handleSearchListboxKeydown({
    activeIndex: itemIndex,
    event,
    inputElement,
    isInteractive: canNavigateResults,
    items: flatItems,
    onActiveIndexChange: (index) => {
      activeIndex = index;
    },
    onSelect: navigateTo,
  });
}

function navigateTo(item: GlobalSearchResultItem) {
  if (item.external) {
    window.open(item.href, "_blank", "noopener,noreferrer");
    return;
  }
  void goto(item.href);
}

onMount(() => {
  applyQueryFromUrl($page.url.searchParams.get("q") ?? "", true);
  queueMicrotask(() => inputElement?.focus());
});

afterNavigate(({ to }) => {
  if (!to) return;
  const urlQuery = to.url.searchParams.get("q") ?? "";
  if (urlQuery === query) return;
  applyQueryFromUrl(urlQuery, true);
});
</script>

<svelte:head>
  <title>{data.copy.pageTitle} - Life@USTC</title>
</svelte:head>

<div class="mx-auto grid w-full max-w-3xl gap-5 px-4 py-6 sm:px-6">
  <div class="grid gap-1">
    <h1 class="font-semibold text-2xl tracking-normal sm:text-3xl">
      {data.copy.pageTitle}
    </h1>
    <p class="text-muted-foreground text-sm">{data.copy.pageDescription}</p>
  </div>

  <div class="relative">
    <SearchIcon
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
    />
    <input
      bind:this={inputElement}
      bind:value={query}
      aria-activedescendant={activeItemId
        ? globalSearchItemDomId(activeItemId)
        : undefined}
      aria-busy={isSearching}
      aria-controls={GLOBAL_SEARCH_LISTBOX_ID}
      aria-expanded={canNavigateResults}
      class={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent pr-3 pl-9 text-base outline-none focus-visible:ring-3 md:text-sm",
      )}
      oncompositionend={handleCompositionEnd}
      oninput={handleQueryInput}
      onkeydown={handleInputKeydown}
      placeholder={data.copy.placeholderSignedIn}
      role="combobox"
      type="search"
    />
  </div>

  <div class="rounded-xl border bg-card p-2 shadow-sm">
    <GlobalSearchResults
      {activeItemId}
      copy={data.copy}
      {groups}
      {isSearching}
      {showHint}
      {showInitialHint}
      onResultKeydown={handleResultKeydown}
      onSelect={navigateTo}
    />
  </div>
</div>
