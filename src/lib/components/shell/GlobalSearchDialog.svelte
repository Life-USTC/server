<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import XIcon from "@lucide/svelte/icons/x";
import { createEventDispatcher } from "svelte";
import {
  fetchGlobalSearch,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_DIALOG_LIMIT,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
} from "@/features/search/lib/global-search-client";
import {
  activeItemIdFromIndex,
  flattenSearchGroups,
  GLOBAL_SEARCH_LISTBOX_ID,
  globalSearchItemDomId,
  handleSearchListboxKeydown,
} from "@/features/search/lib/global-search-keyboard";
import type {
  GlobalSearchResultGroup,
  GlobalSearchResultItem,
} from "@/features/search/server/global-search-types";
import { goto } from "$app/navigation";
import GlobalSearchResults from "$lib/components/shell/GlobalSearchResults.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";

export let copy: LayoutCopy["globalSearch"];
export let open = false;
export let signedIn = false;

const dispatch = createEventDispatcher<{
  openChange: boolean;
}>();

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
$: canNavigateResults =
  !isSearching && !showHint && !showInitialHint && flatItems.length > 0;

$: placeholder = signedIn ? copy.placeholderSignedIn : copy.placeholder;
$: showHint =
  query.trim().length > 0 &&
  query.trim().length < GLOBAL_SEARCH_MIN_QUERY_LENGTH;
$: showInitialHint = open && !hasSearched && query.trim().length === 0;
$: viewAllHref =
  query.trim().length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH
    ? `/search?q=${encodeURIComponent(query.trim())}`
    : "/search";

function resetSearchState() {
  clearTimeout(searchDebounceTimer);
  searchGeneration += 1;
  query = "";
  groups = [];
  hasSearched = false;
  isSearching = false;
  activeIndex = -1;
}

function resetSelection() {
  activeIndex = -1;
}

function handleOpenChange(nextOpen: boolean) {
  open = nextOpen;
  dispatch("openChange", nextOpen);
  if (!nextOpen) resetSearchState();
}

function scheduleSearch() {
  clearTimeout(searchDebounceTimer);

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
    const body = await fetchGlobalSearch(trimmed, GLOBAL_SEARCH_DIALOG_LIMIT);
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
  handleOpenChange(false);
  if (item.external) {
    window.open(item.href, "_blank", "noopener,noreferrer");
    return;
  }
  void goto(item.href);
}

function openSearchPage() {
  handleOpenChange(false);
  void goto(viewAllHref);
}

$: if (open) {
  queueMicrotask(() => inputElement?.focus());
}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
    <Dialog.Header class="space-y-0 border-b px-4 py-3">
      <Dialog.Title class="sr-only">{copy.title}</Dialog.Title>
      <div class="flex items-center gap-3">
        <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
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
            "placeholder:text-muted-foreground h-9 min-w-0 flex-1 border-0 bg-transparent px-0 text-base outline-none md:text-sm",
          )}
          oncompositionend={handleCompositionEnd}
          oninput={handleQueryInput}
          onkeydown={handleInputKeydown}
          placeholder={placeholder}
          role="combobox"
          type="text"
        />
        <Button
          aria-label={copy.close}
          class="shrink-0"
          onclick={() => handleOpenChange(false)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon class="size-4" />
        </Button>
      </div>
    </Dialog.Header>

    <ScrollArea class="max-h-[min(60vh,28rem)]">
      <div class="min-h-48 p-2">
        <GlobalSearchResults
          {activeItemId}
          {copy}
          {groups}
          {isSearching}
          {showHint}
          {showInitialHint}
          onResultKeydown={handleResultKeydown}
          onSelect={navigateTo}
        />
      </div>
    </ScrollArea>

    <div class="border-t px-4 py-2">
      <Button
        class="w-full justify-center"
        onclick={openSearchPage}
        type="button"
        variant="ghost"
      >
        {copy.viewAllResults}
      </Button>
    </div>
  </Dialog.Content>
</Dialog.Root>
