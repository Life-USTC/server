<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import LinkIcon from "@lucide/svelte/icons/link";
import ListTodoIcon from "@lucide/svelte/icons/list-todo";
import RouteIcon from "@lucide/svelte/icons/route";
import SearchXIcon from "@lucide/svelte/icons/search-x";
import UsersIcon from "@lucide/svelte/icons/users";
import {
  GLOBAL_SEARCH_LISTBOX_ID,
  flattenSearchGroups,
  globalSearchItemDomId,
} from "@/features/search/lib/global-search-keyboard";
import type {
  GlobalSearchResultGroup,
  GlobalSearchResultGroupType,
  GlobalSearchResultItem,
} from "@/features/search/server/global-search-types";
import * as Empty from "$lib/components/ui/empty/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";

export let copy: LayoutCopy["globalSearch"];
export let groups: GlobalSearchResultGroup[] = [];
export let activeItemId: string | null = null;
export let isSearching = false;
export let showHint = false;
export let showInitialHint = false;
export let onSelect: (item: GlobalSearchResultItem) => void = () => {};
export let onResultKeydown: (event: KeyboardEvent, itemIndex: number) => void =
  () => {};

const groupIcons: Record<GlobalSearchResultGroupType, typeof BookOpenIcon> = {
  courses: BookOpenIcon,
  homeworks: ClipboardCheckIcon,
  links: LinkIcon,
  sections: RouteIcon,
  teachers: UsersIcon,
  todos: ListTodoIcon,
};

$: flatItems = flattenSearchGroups(groups);
$: showEmpty =
  !isSearching && !showHint && !showInitialHint && groups.length === 0;
</script>

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
  <div aria-label={copy.title} id={GLOBAL_SEARCH_LISTBOX_ID} role="listbox">
    {#each groups as group, groupIndex (group.type)}
      {@const Icon = groupIcons[group.type]}
      {#if groupIndex > 0}
        <Separator class="my-2" />
      {/if}
      <div class="px-2 py-1">
        <p
          class="px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide"
          id={`global-search-group-${group.type}`}
        >
          {copy.groups[group.type]}
        </p>
        <ul
          aria-labelledby={`global-search-group-${group.type}`}
          class="grid gap-1"
          role="group"
        >
          {#each group.items as item (item.id)}
            {@const itemIndex = flatItems.findIndex(
              (candidate) => candidate.id === item.id,
            )}
            {@const isActive = activeItemId === item.id}
            <li role="presentation">
              <button
                id={globalSearchItemDomId(item.id)}
                aria-selected={isActive}
                class={cn(
                  "hover:bg-muted flex w-full min-w-0 items-start gap-3 rounded-md px-2 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive && "bg-muted",
                )}
                onclick={() => onSelect(item)}
                onkeydown={(event) => onResultKeydown(event, itemIndex)}
                role="option"
                type="button"
              >
                <Icon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate font-medium">{item.title}</span>
                    {#if item.external}
                      <ExternalLinkIcon
                        aria-hidden="true"
                        class="size-3.5 shrink-0 text-muted-foreground"
                      />
                    {/if}
                  </span>
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
  </div>
{/if}
