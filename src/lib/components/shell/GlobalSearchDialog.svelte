<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import XIcon from "@lucide/svelte/icons/x";
import { createEventDispatcher } from "svelte";
import { writable } from "svelte/store";
import {
  GLOBAL_SEARCH_DIALOG_LIMIT,
  GLOBAL_SEARCH_MAX_QUERY_LENGTH,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
} from "@/features/search/lib/global-search-client";
import { createGlobalSearchController } from "@/features/search/lib/global-search-controller";
import {
  GLOBAL_SEARCH_LISTBOX_ID,
  globalSearchItemDomId,
} from "@/features/search/lib/global-search-keyboard";
import type { GlobalSearchResultItem } from "@/features/search/server/global-search-types";
import type { AppLocale } from "@/i18n/config";
import { goto } from "$app/navigation";
import GlobalSearchResults from "$lib/components/shell/GlobalSearchResults.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";

export let copy: LayoutCopy["globalSearch"];
export let locale: AppLocale;
export let open = false;
export let signedIn = false;

const dispatch = createEventDispatcher<{
  openChange: boolean;
}>();

let inputElement: HTMLInputElement | null = null;
const dialogOpen = writable(false);
$: dialogOpen.set(open);

const search = createGlobalSearchController({
  getRequestContext: () => ({
    includeWorkspace: signedIn,
    locale,
  }),
  limit: GLOBAL_SEARCH_DIALOG_LIMIT,
  showInitialHintDeps: dialogOpen,
  getShowInitialHint: ({ hasSearched, query }) =>
    open && !hasSearched && query.trim().length === 0,
  onNavigate: (item) => {
    handleOpenChange(false);
    navigateToItem(item);
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
  reset,
  handleCompositionEnd,
  handleQueryInput,
  handleInputKeydown,
  handleResultKeydown,
  navigateTo,
} = search;

function navigateToItem(item: GlobalSearchResultItem) {
  if (item.external) {
    window.open(item.href, "_blank", "noopener,noreferrer");
    return;
  }
  void goto(item.href);
}

function handleOpenChange(nextOpen: boolean) {
  open = nextOpen;
  dispatch("openChange", nextOpen);
  if (!nextOpen) reset();
}

$: placeholder = signedIn ? copy.placeholderSignedIn : copy.placeholder;
$: viewAllHref =
  $query.trim().length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH
    ? `/search?q=${encodeURIComponent($query.trim())}`
    : "/search";

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
          bind:value={$query}
          aria-activedescendant={$activeItemId
            ? globalSearchItemDomId($activeItemId)
            : undefined}
          aria-busy={$isSearching}
          aria-controls={GLOBAL_SEARCH_LISTBOX_ID}
          aria-expanded={$canNavigateResults}
          class={cn(
            "placeholder:text-muted-foreground h-9 min-w-0 flex-1 border-0 bg-transparent px-0 text-base outline-none md:text-sm",
          )}
          oncompositionend={handleCompositionEnd}
          oninput={handleQueryInput}
          onkeydown={(event) => handleInputKeydown(event, inputElement)}
          placeholder={placeholder}
          maxlength={GLOBAL_SEARCH_MAX_QUERY_LENGTH}
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
          activeItemId={$activeItemId}
          {copy}
          groups={$groups}
          isSearching={$isSearching}
          showHint={$showHint}
          showInitialHint={$showInitialHint}
          onResultKeydown={(event, itemIndex) =>
            handleResultKeydown(event, itemIndex, inputElement)}
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
