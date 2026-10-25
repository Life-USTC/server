import { onDestroy, tick, untrack } from "svelte";
import { goto, preloadData, snapshot } from "$app/navigation";
import { navigating, page as routePage } from "$app/state";

export type EndlessScrollLabels = {
  loading: string;
  loadMore: string;
  retry: string;
  failed: string;
};

export type EndlessScrollState = {
  readonly loading: boolean;
  readonly error: boolean;
  readonly hasMore: boolean;
  readonly nextHref: string;
  loadMore: () => Promise<void>;
};

type Slice<T> = { items: T[]; page: number; totalPages: number };

function viewerIdentity(data: typeof routePage.data) {
  return JSON.stringify([
    data.locale,
    data.user?.id ?? data.userId ?? data.navStats?.user?.id,
    data.demo?.fixtureVersion,
    data.demo?.expiresAt,
  ]);
}

function scrollContainers() {
  return [
    document.documentElement,
    ...document.querySelectorAll<HTMLElement>(
      "[data-shell-scroll-container], [data-detail-scroll-container]",
    ),
  ];
}

/** Reuse the route's read boundary; never substitute a differently filtered API. */
export function createEndlessList<Data, Row>(options: {
  source: () => Data;
  select: (data: Data) => Slice<Row>;
  key: (row: Row) => string | number;
  pageHref: (page: number) => string;
}) {
  function session(source: Data, identity: string) {
    const initial = options.select(source);
    let value = $state.raw({ ...initial, loading: false, error: false });
    return {
      identity,
      get value() {
        return value;
      },
      set value(next) {
        value = next;
      },
    };
  }

  const current = $derived.by(() => {
    const data = routePage.data;
    const identity = JSON.stringify([
      routePage.url.pathname + routePage.url.search,
      viewerIdentity(data),
    ]);
    return session(options.source(), identity);
  });
  let disposed = false;
  onDestroy(() => {
    disposed = true;
  });

  snapshot({
    id: `endless:${untrack(() => routePage.route.id)}`,
    capture: () => ({
      identity: current.identity,
      ...current.value,
      loading: false,
      error: false,
      scroll: scrollContainers().map((element) => ({
        left: element.scrollLeft,
        top: element.scrollTop,
      })),
    }),
    restore: async (saved) => {
      if (
        navigating.type === "popstate" &&
        saved.identity === current.identity
      ) {
        const target = current;
        const { scroll, ...value } = saved;
        target.value = { ...value, loading: false, error: false };
        // The accumulated rows must render before the scroll range is restored.
        await tick();
        if (disposed || target !== current) return;
        scrollContainers().forEach((element, index) => {
          element.scrollTo(scroll[index]);
        });
      }
    },
  });

  async function loadMore() {
    const target = current;
    const state = target.value;
    if (disposed || state.loading || state.page >= state.totalPages) return;
    target.value = { ...state, loading: true, error: false };
    const nextPage = state.page + 1;
    try {
      const result = await preloadData(options.pageHref(nextPage));
      if (disposed || target !== current) return;
      if (result.type === "redirect") {
        await goto(result.location, {
          replace: true,
          reset: false,
          refreshAll: true,
        });
        return;
      }
      if (result.type !== "loaded" || result.status !== 200)
        throw new Error("Page unavailable");
      if (viewerIdentity(result.data) !== viewerIdentity(routePage.data)) {
        await goto(routePage.url.href, {
          replace: true,
          reset: false,
          refreshAll: true,
        });
        return;
      }
      const next = options.select(result.data as Data);
      if (next.page !== nextPage) throw new Error("Unexpected page");
      const seen = new Set(target.value.items.map(options.key));
      const added = next.items.filter((item) => {
        const key = options.key(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      target.value = {
        items: [...target.value.items, ...added],
        page: next.page,
        totalPages: next.items.length ? next.totalPages : next.page,
        loading: false,
        error: false,
      };
    } catch {
      if (!disposed && target === current) {
        target.value = { ...target.value, loading: false, error: true };
      }
    }
  }

  const items = $derived(current.value.items);

  return {
    get items() {
      return items;
    },
    get loading() {
      return current.value.loading;
    },
    get error() {
      return current.value.error;
    },
    get hasMore() {
      return current.value.page < current.value.totalPages;
    },
    get nextHref() {
      return options.pageHref(current.value.page + 1);
    },
    loadMore,
    updateItem(updated: Row) {
      current.value = {
        ...current.value,
        items: current.value.items.map((item) =>
          options.key(item) === options.key(updated) ? updated : item,
        ),
      };
    },
  };
}
