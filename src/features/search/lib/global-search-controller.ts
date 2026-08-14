import { derived, get, type Readable, writable } from "svelte/store";
import {
  fetchGlobalSearch,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
} from "@/features/search/lib/global-search-client";
import {
  activeItemIdFromIndex,
  flattenSearchGroups,
  handleSearchListboxKeydown,
} from "@/features/search/lib/global-search-keyboard";
import type {
  GlobalSearchResultGroup,
  GlobalSearchResultItem,
} from "@/features/search/server/global-search-types";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";

export type GlobalSearchUrlSyncOptions = {
  getPageUrl: () => URL;
  goto: (
    href: string,
    options?: {
      keepFocus?: boolean;
      noScroll?: boolean;
      replaceState?: boolean;
    },
  ) => Promise<void>;
};

export type GlobalSearchControllerOptions = {
  limit: number;
  getRequestContext?: () => {
    includeWorkspace?: boolean;
    locale: AppLocale;
  };
  urlSync?: GlobalSearchUrlSyncOptions;
  showInitialHintDeps?: Readable<unknown>;
  getShowInitialHint?: (state: {
    hasSearched: boolean;
    query: string;
  }) => boolean;
  onNavigate?: (item: GlobalSearchResultItem) => void;
};

export type GlobalSearchController = {
  query: ReturnType<typeof writable<string>>;
  groups: ReturnType<typeof writable<GlobalSearchResultGroup[]>>;
  isSearching: ReturnType<typeof writable<boolean>>;
  hasSearched: ReturnType<typeof writable<boolean>>;
  activeIndex: ReturnType<typeof writable<number>>;
  flatItems: Readable<GlobalSearchResultItem[]>;
  activeItemId: Readable<string | null>;
  showHint: Readable<boolean>;
  showInitialHint: Readable<boolean>;
  canNavigateResults: Readable<boolean>;
  reset: () => void;
  resetSelection: () => void;
  applyQueryFromUrl: (urlQuery: string, runImmediately?: boolean) => void;
  scheduleSearch: () => void;
  handleQueryInput: (event: Event) => void;
  handleCompositionEnd: (event: CompositionEvent) => void;
  handleInputKeydown: (
    event: KeyboardEvent,
    inputElement: HTMLInputElement | null,
  ) => void;
  handleResultKeydown: (
    event: KeyboardEvent,
    itemIndex: number,
    inputElement: HTMLInputElement | null,
  ) => void;
  navigateTo: (item: GlobalSearchResultItem) => void;
  syncFromUrlNavigation: (url: URL) => void;
};

export function createGlobalSearchController(
  options: GlobalSearchControllerOptions,
): GlobalSearchController {
  const query = writable("");
  const groups = writable<GlobalSearchResultGroup[]>([]);
  const isSearching = writable(false);
  const hasSearched = writable(false);
  const activeIndex = writable(-1);

  let searchGeneration = 0;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  const flatItems = derived(groups, ($groups) => flattenSearchGroups($groups));

  const showHint = derived(query, ($query) => {
    const trimmed = $query.trim();
    return (
      trimmed.length > 0 && trimmed.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH
    );
  });

  const showInitialHint = derived(
    [hasSearched, query, options.showInitialHintDeps ?? writable(null)],
    ([$hasSearched, $query]) => {
      if (options.getShowInitialHint) {
        return options.getShowInitialHint({
          hasSearched: $hasSearched,
          query: $query,
        });
      }
      return !$hasSearched && $query.trim().length === 0;
    },
  );

  const canNavigateResults = derived(
    [isSearching, showHint, showInitialHint, flatItems],
    ([$isSearching, $showHint, $showInitialHint, $flatItems]) =>
      !$isSearching && !$showHint && !$showInitialHint && $flatItems.length > 0,
  );

  const activeItemId = derived(
    [flatItems, activeIndex],
    ([$flatItems, $activeIndex]) =>
      activeItemIdFromIndex($flatItems, $activeIndex),
  );

  function resetSelection() {
    activeIndex.set(-1);
  }

  function clearSearchDebounce() {
    clearTimeout(searchDebounceTimer);
  }

  function reset() {
    clearSearchDebounce();
    searchGeneration += 1;
    query.set("");
    groups.set([]);
    hasSearched.set(false);
    isSearching.set(false);
    activeIndex.set(-1);
  }

  function updateUrlQuery(nextQuery: string) {
    const urlSync = options.urlSync;
    if (!urlSync) return;

    const url = new URL(urlSync.getPageUrl());
    const trimmed = nextQuery.trim();
    if (trimmed) {
      url.searchParams.set("q", trimmed);
    } else {
      url.searchParams.delete("q");
    }
    const nextHref = `${url.pathname}${url.search}`;
    const currentUrl = urlSync.getPageUrl();
    const currentHref = `${currentUrl.pathname}${currentUrl.search}`;
    if (nextHref !== currentHref) {
      void urlSync.goto(nextHref, {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
      });
    }
  }

  async function runSearch() {
    const trimmed = get(query).trim();
    if (trimmed.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      groups.set([]);
      hasSearched.set(false);
      return;
    }

    const generation = ++searchGeneration;
    isSearching.set(true);
    hasSearched.set(true);

    try {
      const body = await fetchGlobalSearch(
        trimmed,
        options.limit,
        options.getRequestContext?.() ?? { locale: DEFAULT_LOCALE },
      );
      if (generation !== searchGeneration) return;
      groups.set(body.groups ?? []);
    } catch {
      if (generation !== searchGeneration) return;
      groups.set([]);
    } finally {
      if (generation === searchGeneration) {
        isSearching.set(false);
      }
    }
  }

  function scheduleSearch() {
    clearSearchDebounce();
    updateUrlQuery(get(query));

    const trimmed = get(query).trim();
    if (trimmed.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      searchGeneration += 1;
      groups.set([]);
      hasSearched.set(false);
      isSearching.set(false);
      resetSelection();
      return;
    }

    resetSelection();
    searchDebounceTimer = setTimeout(() => {
      void runSearch();
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
  }

  function applyQueryFromUrl(urlQuery: string, runImmediately = false) {
    query.set(urlQuery);
    if (urlQuery.trim().length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      if (runImmediately) {
        void runSearch();
        return;
      }
      scheduleSearch();
      return;
    }
    groups.set([]);
    hasSearched.set(false);
    isSearching.set(false);
    resetSelection();
  }

  function handleQueryInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    query.set(input.value);
    if (event instanceof InputEvent && event.isComposing) {
      return;
    }
    scheduleSearch();
  }

  function handleCompositionEnd(event: CompositionEvent) {
    query.set((event.currentTarget as HTMLInputElement).value);
    scheduleSearch();
  }

  function navigateTo(item: GlobalSearchResultItem) {
    if (options.onNavigate) {
      options.onNavigate(item);
      return;
    }
    if (item.external) {
      window.open(item.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (options.urlSync) {
      void options.urlSync.goto(item.href);
    }
  }

  function handleInputKeydown(
    event: KeyboardEvent,
    inputElement: HTMLInputElement | null,
  ) {
    handleSearchListboxKeydown({
      activeIndex: get(activeIndex),
      event,
      inputElement,
      isInteractive: get(canNavigateResults),
      items: get(flatItems),
      onActiveIndexChange: (index) => {
        activeIndex.set(index);
      },
      onSelect: navigateTo,
    });
  }

  function handleResultKeydown(
    event: KeyboardEvent,
    itemIndex: number,
    inputElement: HTMLInputElement | null,
  ) {
    if (itemIndex >= 0 && itemIndex !== get(activeIndex)) {
      activeIndex.set(itemIndex);
    }
    handleSearchListboxKeydown({
      activeIndex: itemIndex,
      event,
      inputElement,
      isInteractive: get(canNavigateResults),
      items: get(flatItems),
      onActiveIndexChange: (index) => {
        activeIndex.set(index);
      },
      onSelect: navigateTo,
    });
  }

  function syncFromUrlNavigation(url: URL) {
    const urlQuery = url.searchParams.get("q") ?? "";
    if (urlQuery === get(query)) return;
    applyQueryFromUrl(urlQuery, true);
  }

  return {
    query,
    groups,
    isSearching,
    hasSearched,
    activeIndex,
    flatItems,
    activeItemId,
    showHint,
    showInitialHint,
    canNavigateResults,
    reset,
    resetSelection,
    applyQueryFromUrl,
    scheduleSearch,
    handleQueryInput,
    handleCompositionEnd,
    handleInputKeydown,
    handleResultKeydown,
    navigateTo,
    syncFromUrlNavigation,
  };
}

export function mountGlobalSearchUrlSync(
  controller: GlobalSearchController,
  input: {
    getPageUrl: () => URL;
  },
) {
  controller.applyQueryFromUrl(
    input.getPageUrl().searchParams.get("q") ?? "",
    true,
  );

  return {
    handleAfterNavigate: (to: URL | undefined) => {
      if (!to) return;
      controller.syncFromUrlNavigation(to);
    },
  };
}
