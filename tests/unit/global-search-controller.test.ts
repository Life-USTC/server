import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GLOBAL_SEARCH_DEBOUNCE_MS } from "@/features/search/lib/global-search-client";
import {
  createGlobalSearchController,
  mountGlobalSearchUrlSync,
} from "@/features/search/lib/global-search-controller";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockSearchFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

describe("createGlobalSearchController", () => {
  it("debounces search and fetches with the configured limit", async () => {
    vi.useFakeTimers();
    const fetchMock = mockSearchFetch({
      groups: [
        {
          type: "courses",
          items: [
            {
              id: "course:1",
              title: "Math",
              description: null,
              href: "/catalog/courses/1",
            },
          ],
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const controller = createGlobalSearchController({ limit: 5 });
    controller.query.set("math");

    controller.scheduleSearch();
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(GLOBAL_SEARCH_DEBOUNCE_MS);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/search?q=${encodeURIComponent("math")}&limit=5&locale=zh-cn`,
    );
    expect(get(controller.groups)).toHaveLength(1);
    expect(get(controller.isSearching)).toBe(false);
    expect(get(controller.hasSearched)).toBe(true);

    vi.useRealTimers();
  });

  it("uses an explicit locale and isolated workspace scope", async () => {
    vi.useFakeTimers();
    const fetchMock = mockSearchFetch({ groups: [] });
    vi.stubGlobal("fetch", fetchMock);

    const controller = createGlobalSearchController({
      getRequestContext: () => ({
        includeWorkspace: true,
        locale: "en-us",
      }),
      limit: 5,
    });
    controller.query.set("math");
    controller.scheduleSearch();

    await vi.advanceTimersByTimeAsync(GLOBAL_SEARCH_DEBOUNCE_MS);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search?q=math&limit=5&locale=en-us&scope=workspace",
    );

    vi.useRealTimers();
  });

  it("clears results when query is shorter than the minimum length", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());

    const controller = createGlobalSearchController({ limit: 5 });
    controller.query.set("ab");
    controller.scheduleSearch();
    controller.query.set("a");
    controller.scheduleSearch();

    expect(get(controller.groups)).toEqual([]);
    expect(get(controller.hasSearched)).toBe(false);
    expect(get(controller.isSearching)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("drops in-flight results after the query drops below the minimum length", async () => {
    vi.useFakeTimers();
    let resolveSearch: ((response: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const controller = createGlobalSearchController({ limit: 5 });
    controller.query.set("ab");
    controller.scheduleSearch();
    await vi.advanceTimersByTimeAsync(GLOBAL_SEARCH_DEBOUNCE_MS);

    controller.query.set("a");
    controller.scheduleSearch();

    resolveSearch?.({
      ok: true,
      json: () =>
        Promise.resolve({
          groups: [
            {
              type: "courses",
              items: [
                {
                  id: "course:stale",
                  title: "Stale",
                  description: null,
                  href: "/catalog/courses/stale",
                },
              ],
            },
          ],
        }),
    });
    await vi.runAllTimersAsync();

    expect(get(controller.groups)).toEqual([]);
    expect(get(controller.hasSearched)).toBe(false);

    vi.useRealTimers();
  });

  it("ignores stale responses when a newer search starts", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((response: unknown) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            groups: [
              {
                type: "courses",
                items: [
                  {
                    id: "course:new",
                    title: "New",
                    description: null,
                    href: "/catalog/courses/new",
                  },
                ],
              },
            ],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const controller = createGlobalSearchController({ limit: 5 });
    controller.query.set("old query");
    controller.scheduleSearch();
    await vi.advanceTimersByTimeAsync(GLOBAL_SEARCH_DEBOUNCE_MS);

    controller.query.set("new query");
    controller.scheduleSearch();
    await vi.advanceTimersByTimeAsync(GLOBAL_SEARCH_DEBOUNCE_MS);
    await vi.runAllTimersAsync();

    resolveFirst?.({
      ok: true,
      json: () =>
        Promise.resolve({
          groups: [
            {
              type: "courses",
              items: [
                {
                  id: "course:old",
                  title: "Old",
                  description: null,
                  href: "/catalog/courses/old",
                },
              ],
            },
          ],
        }),
    });
    await vi.runAllTimersAsync();

    expect(get(controller.groups)[0]?.items[0]?.id).toBe("course:new");

    vi.useRealTimers();
  });

  it("syncs query to the URL when urlSync is configured", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockSearchFetch({ groups: [] }));

    const pageUrl = new URL("https://example.test/search");
    const goto = vi.fn().mockResolvedValue(undefined);
    const controller = createGlobalSearchController({
      limit: 20,
      urlSync: {
        getPageUrl: () => pageUrl,
        goto,
      },
    });

    controller.query.set("physics");
    controller.scheduleSearch();

    expect(goto).toHaveBeenCalledOnce();
    expect(goto).toHaveBeenCalledWith("/search?q=physics", {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });

    vi.useRealTimers();
  });

  it("defers search while IME composition is active", async () => {
    vi.useFakeTimers();
    const fetchMock = mockSearchFetch({ groups: [] });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "InputEvent",
      class MockInputEvent extends Event {
        isComposing: boolean;
        constructor(type: string, init?: { isComposing?: boolean }) {
          super(type);
          this.isComposing = init?.isComposing ?? false;
        }
      },
    );
    vi.stubGlobal(
      "CompositionEvent",
      class MockCompositionEvent extends Event {},
    );

    const controller = createGlobalSearchController({ limit: 5 });
    const input = { value: "ni" } as HTMLInputElement;

    const composingEvent = new InputEvent("input", {
      bubbles: true,
      isComposing: true,
    });
    Object.defineProperty(composingEvent, "currentTarget", { value: input });
    controller.handleQueryInput(composingEvent);

    expect(get(controller.query)).toBe("ni");
    expect(fetchMock).not.toHaveBeenCalled();

    const endEvent = new CompositionEvent("compositionend", { bubbles: true });
    Object.defineProperty(endEvent, "currentTarget", { value: input });
    controller.handleCompositionEnd(endEvent);

    await vi.advanceTimersByTimeAsync(GLOBAL_SEARCH_DEBOUNCE_MS);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it("uses onNavigate when provided", () => {
    const onNavigate = vi.fn();
    const controller = createGlobalSearchController({
      limit: 5,
      onNavigate,
    });
    const item = {
      id: "course:1",
      title: "Math",
      description: null,
      href: "/catalog/courses/1",
    };

    controller.navigateTo(item);
    expect(onNavigate).toHaveBeenCalledWith(item);
  });

  it("resets all state", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      mockSearchFetch({
        groups: [
          {
            type: "courses",
            items: [
              {
                id: "course:1",
                title: "Math",
                description: null,
                href: "/catalog/courses/1",
              },
            ],
          },
        ],
      }),
    );

    const controller = createGlobalSearchController({ limit: 5 });
    controller.query.set("math");
    controller.scheduleSearch();
    await vi.advanceTimersByTimeAsync(GLOBAL_SEARCH_DEBOUNCE_MS);
    await vi.runAllTimersAsync();

    controller.reset();

    expect(get(controller.query)).toBe("");
    expect(get(controller.groups)).toEqual([]);
    expect(get(controller.hasSearched)).toBe(false);
    expect(get(controller.isSearching)).toBe(false);
    expect(get(controller.activeIndex)).toBe(-1);

    vi.useRealTimers();
  });
});

describe("mountGlobalSearchUrlSync", () => {
  it("applies the initial URL query and handles later navigation", async () => {
    vi.useFakeTimers();
    const fetchMock = mockSearchFetch({ groups: [] });
    vi.stubGlobal("fetch", fetchMock);

    const pageUrl = new URL("https://example.test/search?q=algebra");
    const controller = createGlobalSearchController({
      limit: 20,
      urlSync: {
        getPageUrl: () => pageUrl,
        goto: vi.fn(),
      },
    });

    const mount = mountGlobalSearchUrlSync(controller, {
      getPageUrl: () => pageUrl,
    });

    await Promise.resolve();
    expect(get(controller.query)).toBe("algebra");

    mount.handleAfterNavigate(
      new URL("https://example.test/search?q=calculus"),
    );
    await Promise.resolve();
    expect(get(controller.query)).toBe("calculus");

    mount.handleAfterNavigate(
      new URL("https://example.test/search?q=calculus"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
