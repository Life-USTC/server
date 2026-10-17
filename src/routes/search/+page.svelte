<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { onMount } from "svelte";
import { get } from "svelte/store";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import * as Field from "#lib/components/ui/field/index.js";
import * as InputGroup from "#lib/components/ui/input-group/index.js";
import GlobalSearchResults from "@/features/search/components/GlobalSearchResults.svelte";
import {
  GLOBAL_SEARCH_MAX_QUERY_LENGTH,
  GLOBAL_SEARCH_PAGE_LIMIT,
} from "@/features/search/lib/global-search-client";
import {
  createGlobalSearchController,
  mountGlobalSearchUrlSync,
} from "@/features/search/lib/global-search-controller";
import {
  GLOBAL_SEARCH_LISTBOX_ID,
  globalSearchItemDomId,
} from "@/features/search/lib/global-search-keyboard";
import { legacyPageStore } from "@/lib/navigation/legacy-page-stores";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { afterNavigate, goto } from "$app/navigation";
import type { PageData } from "./$types";

const page = legacyPageStore();

export let data: PageData;

let inputElement: HTMLInputElement | null = null;
const shellViewer = getShellViewer();
let viewerId: string | null = null;

const search = createGlobalSearchController({
  getRequestContext: () => ({
    includeWorkspace: viewerId !== null,
    locale: data.locale,
  }),
  limit: GLOBAL_SEARCH_PAGE_LIMIT,
  urlSync: {
    getPageUrl: () => new URL($page.url.href),
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
  const unsubscribe = shellViewer.subscribe(({ status, viewer }) => {
    const nextViewerId = status === "ready" ? (viewer?.id ?? null) : null;
    if (nextViewerId === viewerId) return;
    viewerId = nextViewerId;
    // Cancel the previous identity's request and remove its results before
    // repeating the current query with the newly resolved private scope.
    const currentQuery = get(search.query);
    search.reset();
    search.applyQueryFromUrl(currentQuery, true);
  });
  urlSyncMount = mountGlobalSearchUrlSync(search, {
    getPageUrl: () => new URL($page.url.href),
  });
  queueMicrotask(() => inputElement?.focus());
  return () => {
    unsubscribe();
    search.reset();
  };
});

afterNavigate(({ to, shallow, type }) => {
  if (shallow && type === "goto") return;

  urlSyncMount?.handleAfterNavigate(to?.url);
});
</script>

<svelte:head><title>{data.copy.pageTitle} - Life@USTC</title></svelte:head>

<CollectionPage description={data.copy.pageDescription} title={data.copy.pageTitle}>
  {#snippet toolbar()}
  <Field.Field class="gap-1">
    <Field.Label class="sr-only" for="global-search-page-input">
      {data.copy.pageTitle}
    </Field.Label>
    <InputGroup.Root class="h-11 rounded-lg">
      <InputGroup.Addon class="px-0 ps-3">
        <SearchIcon aria-hidden="true" class="text-muted-foreground" />
      </InputGroup.Addon>
      <InputGroup.Input
        bind:ref={inputElement}
        bind:value={$query}
        aria-activedescendant={$activeItemId
          ? globalSearchItemDomId($activeItemId)
          : undefined}
        aria-busy={$isSearching}
        aria-controls={GLOBAL_SEARCH_LISTBOX_ID}
        aria-expanded={$canNavigateResults}
        class="h-11 rounded-lg border-0 bg-transparent pr-3 ps-3 text-base outline-none md:text-sm"
        id="global-search-page-input"
        oncompositionend={handleCompositionEnd}
        oninput={handleQueryInput}
        onkeydown={(event) => handleInputKeydown(event, inputElement)}
        placeholder={data.copy.placeholderSignedIn}
        maxlength={GLOBAL_SEARCH_MAX_QUERY_LENGTH}
        role="combobox"
        type="search"
      />
    </InputGroup.Root>
  </Field.Field>
  {/snippet}

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
</CollectionPage>
