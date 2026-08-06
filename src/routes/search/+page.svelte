<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { onMount } from "svelte";
import { GLOBAL_SEARCH_PAGE_LIMIT } from "@/features/search/lib/global-search-client";
import {
  createGlobalSearchController,
  mountGlobalSearchUrlSync,
} from "@/features/search/lib/global-search-controller";
import {
  GLOBAL_SEARCH_LISTBOX_ID,
  globalSearchItemDomId,
} from "@/features/search/lib/global-search-keyboard";
import { afterNavigate, goto } from "$app/navigation";
import { page } from "$app/stores";
import PageHeader from "$lib/components/PageHeader.svelte";
import GlobalSearchResults from "$lib/components/shell/GlobalSearchResults.svelte";
import { cn } from "$lib/utils.js";
import type { PageData } from "./$types";

export let data: PageData;

let inputElement: HTMLInputElement | null = null;

const search = createGlobalSearchController({
  limit: GLOBAL_SEARCH_PAGE_LIMIT,
  urlSync: {
    getPageUrl: () => $page.url,
    goto,
  },
});

const {
  query,
  groups,
  isSearching,
  activeItemId,
  showHint,
  showInitialHint,
  canNavigateResults,
  handleCompositionEnd,
  handleQueryInput,
  handleInputKeydown,
  handleResultKeydown,
  navigateTo,
} = search;

let urlSyncMount: ReturnType<typeof mountGlobalSearchUrlSync>;

onMount(() => {
  urlSyncMount = mountGlobalSearchUrlSync(search, {
    getPageUrl: () => $page.url,
  });
  queueMicrotask(() => inputElement?.focus());
});

afterNavigate(({ to }) => {
  urlSyncMount?.handleAfterNavigate(to?.url);
});
</script>

<svelte:head>
  <title>{data.copy.pageTitle} - Life@USTC</title>
</svelte:head>

<section class="grid gap-5">
  <PageHeader
    title={data.copy.pageTitle}
    description={data.copy.pageDescription}
  />

  <div class="relative">
    <SearchIcon
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
    />
    <input
      bind:this={inputElement}
      bind:value={$query}
      aria-activedescendant={$activeItemId
        ? globalSearchItemDomId($activeItemId)
        : undefined}
      aria-busy={$isSearching}
      aria-controls={GLOBAL_SEARCH_LISTBOX_ID}
      aria-expanded={$canNavigateResults}
      class={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent pr-3 pl-9 text-base outline-none focus-visible:ring-3 md:text-sm",
      )}
      oncompositionend={handleCompositionEnd}
      oninput={handleQueryInput}
      onkeydown={(event) => handleInputKeydown(event, inputElement)}
      placeholder={data.copy.placeholderSignedIn}
      role="combobox"
      type="search"
    />
  </div>

  <div class="rounded-xl border bg-card p-2 shadow-sm">
    <GlobalSearchResults
      activeItemId={$activeItemId}
      copy={data.copy}
      groups={$groups}
      isSearching={$isSearching}
      showHint={$showHint}
      showInitialHint={$showInitialHint}
      onResultKeydown={(event, itemIndex) =>
        handleResultKeydown(event, itemIndex, inputElement)}
      onSelect={navigateTo}
    />
  </div>
</section>
