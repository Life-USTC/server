<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
import ListTodoIcon from "@lucide/svelte/icons/list-todo";
import RouteIcon from "@lucide/svelte/icons/route";
import SearchIcon from "@lucide/svelte/icons/search";
import SearchXIcon from "@lucide/svelte/icons/search-x";
import UsersIcon from "@lucide/svelte/icons/users";
import XIcon from "@lucide/svelte/icons/x";
import { createEventDispatcher } from "svelte";
import { goto } from "$app/navigation";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";

type SearchGroupType =
  | "courses"
  | "homeworks"
  | "sections"
  | "teachers"
  | "todos";

type SearchResultItem = {
  description: string | null;
  href: string;
  id: string;
  title: string;
};

type SearchResultGroup = {
  items: SearchResultItem[];
  type: SearchGroupType;
};

type SearchResponse = {
  groups: SearchResultGroup[];
  query: string;
};

export let copy: LayoutCopy["globalSearch"];
export let open = false;
export let signedIn = false;

const dispatch = createEventDispatcher<{
  openChange: boolean;
}>();

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 200;

let query = "";
let groups: SearchResultGroup[] = [];
let isSearching = false;
let hasSearched = false;
let searchGeneration = 0;
let isComposing = false;
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let inputElement: HTMLInputElement | null = null;

const groupIcons: Record<SearchGroupType, typeof BookOpenIcon> = {
  courses: BookOpenIcon,
  homeworks: ClipboardCheckIcon,
  sections: RouteIcon,
  teachers: UsersIcon,
  todos: ListTodoIcon,
};

$: placeholder = signedIn ? copy.placeholderSignedIn : copy.placeholder;
$: showHint = query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH;
$: showInitialHint = open && !hasSearched && query.trim().length === 0;
$: showEmpty = hasSearched && !isSearching && groups.length === 0 && !showHint;

function resetSearchState() {
  clearTimeout(searchDebounceTimer);
  searchGeneration += 1;
  query = "";
  groups = [];
  hasSearched = false;
  isSearching = false;
  isComposing = false;
}

function handleOpenChange(nextOpen: boolean) {
  open = nextOpen;
  dispatch("openChange", nextOpen);
  if (!nextOpen) resetSearchState();
}

function scheduleSearch() {
  clearTimeout(searchDebounceTimer);

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    groups = [];
    hasSearched = false;
    isSearching = false;
    return;
  }

  searchDebounceTimer = setTimeout(() => {
    void runSearch();
  }, SEARCH_DEBOUNCE_MS);
}

function handleQueryInput() {
  if (isComposing) return;
  scheduleSearch();
}

function handleCompositionStart() {
  isComposing = true;
}

function handleCompositionEnd() {
  isComposing = false;
  scheduleSearch();
}

async function runSearch() {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    groups = [];
    hasSearched = false;
    return;
  }

  const generation = ++searchGeneration;
  isSearching = true;
  hasSearched = true;

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(trimmed)}&limit=5`,
    );
    if (!response.ok || generation !== searchGeneration) return;
    const body = (await response.json()) as SearchResponse;
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

function navigateTo(href: string) {
  handleOpenChange(false);
  void goto(href);
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
          aria-busy={isSearching}
          class={cn(
            "placeholder:text-muted-foreground h-9 min-w-0 flex-1 border-0 bg-transparent px-0 text-base outline-none md:text-sm",
          )}
          oncompositionend={handleCompositionEnd}
          oncompositionstart={handleCompositionStart}
          oninput={handleQueryInput}
          placeholder={placeholder}
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
        {#if isSearching}
          <div
            class="text-muted-foreground flex items-center justify-center gap-2 px-2 py-10 text-sm"
            role="status"
          >
            <Spinner class="size-4 shrink-0" />
            <span>{copy.searching}</span>
          </div>
        {:else if showInitialHint || showHint}
          <p class="px-2 py-6 text-center text-muted-foreground text-sm">
            {copy.hint}
          </p>
        {:else if showEmpty}
          <Empty.Root class="py-8">
            <Empty.Media variant="icon">
              <SearchXIcon />
            </Empty.Media>
            <Empty.Title>{copy.noResults}</Empty.Title>
          </Empty.Root>
        {:else}
          {#each groups as group, groupIndex (group.type)}
            {@const Icon = groupIcons[group.type]}
            {#if groupIndex > 0}
              <Separator class="my-2" />
            {/if}
            <div class="px-2 py-1">
              <p class="px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {copy.groups[group.type]}
              </p>
              <ul class="grid gap-1">
                {#each group.items as item (item.id)}
                  <li>
                    <button
                      class="hover:bg-muted flex w-full min-w-0 items-start gap-3 rounded-md px-2 py-2 text-left transition-colors"
                      onclick={() => navigateTo(item.href)}
                      type="button"
                    >
                      <Icon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span class="min-w-0">
                        <span class="block truncate font-medium">{item.title}</span>
                        {#if item.description}
                          <span class="block truncate text-muted-foreground text-sm">
                            {item.description}
                          </span>
                        {/if}
                      </span>
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        {/if}
      </div>
    </ScrollArea>
  </Dialog.Content>
</Dialog.Root>
