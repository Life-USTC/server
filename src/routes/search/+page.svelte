<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { onMount } from "svelte";
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
import { afterNavigate, goto } from "$app/navigation";
import { page } from "$app/stores";
import PageHeader from "$lib/components/PageHeader.svelte";
import GlobalSearchResults from "$lib/components/shell/GlobalSearchResults.svelte";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import type { PageData } from "./$types";

export let data: PageData;

let inputElement: HTMLInputElement | null = null;

const search = createGlobalSearchController({
  getRequestContext: () => ({
    includeWorkspace: Boolean(data.user),
    locale: data.locale,
  }),
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
