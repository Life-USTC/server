import { beforeEach, expect, test, vi } from "vitest";
import {
  cachedPublicNavigationFetch,
  clearPublicNavigationCache,
} from "@/lib/shell/public-navigation-cache";
import { PUBLIC_NAVIGATION_HEADER } from "@/lib/shell/public-navigation-contract";
import { createDeferred } from "../../../shared/deferred";

const noon = Date.parse("2026-09-28T04:00:00.000Z");
const beforeMidnight = Date.parse("2026-09-28T15:59:50.000Z");

function jsonResponse(body: unknown, headers?: HeadersInit) {
  return Response.json(
    { type: "data", nodes: [{ type: "skip" }, { type: "data", data: [body] }] },
    { headers: { [PUBLIC_NAVIGATION_HEADER]: "1", ...headers } },
  );
}

beforeEach(() => {
  clearPublicNavigationCache();
});

test("clearPublicNavigationCache drops stored navigation entries", async () => {
  const fetcher = vi.fn(async () => jsonResponse({ page: "news" }));
  const url =
    "https://life.example/news/__data.json?x-sveltekit-invalidated=01";
  await cachedPublicNavigationFetch(fetcher, url, undefined, noon, "zh-cn");
  await cachedPublicNavigationFetch(
    fetcher,
    url,
    undefined,
    noon + 1_000,
    "zh-cn",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  clearPublicNavigationCache();
  await cachedPublicNavigationFetch(
    fetcher,
    url,
    undefined,
    noon + 2_000,
    "zh-cn",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test.each(["clear", "invalidate"])(
  "%s prevents outstanding responses from repopulating the cache",
  async (action) => {
    const pending = createDeferred<Response>();
    const fetcher = vi.fn(() => pending.promise);
    const url =
      "https://life.example/news/__data.json?x-sveltekit-invalidated=01";
    const outstanding = cachedPublicNavigationFetch(
      fetcher,
      url,
      undefined,
      noon,
    );

    if (action === "clear") {
      clearPublicNavigationCache();
    } else {
      await cachedPublicNavigationFetch(
        async () => jsonResponse({ page: "invalidated" }),
        url.replace("=01", "=11"),
        undefined,
        noon,
      );
    }

    const fresh = vi.fn(async () => jsonResponse({ page: "fresh" }));
    await cachedPublicNavigationFetch(fresh, url, undefined, noon);
    pending.resolve(jsonResponse({ page: "old" }));
    expect((await (await outstanding).json()).nodes[1].data[0]).toEqual({
      page: "old",
    });
    const next = await cachedPublicNavigationFetch(fresh, url, undefined, noon);
    expect((await next.json()).nodes[1].data[0]).toEqual({ page: "fresh" });
    expect(fresh).toHaveBeenCalledTimes(1);
  },
);

test("clearing while a response body is pending prevents it from being retained", async () => {
  const body = createDeferred<ArrayBuffer>();
  const reading = createDeferred();
  const response = jsonResponse({ page: "old" });
  const bytes = await response.clone().arrayBuffer();
  vi.spyOn(response, "arrayBuffer").mockImplementation(() => {
    reading.resolve();
    return body.promise;
  });
  const url =
    "https://life.example/news/__data.json?x-sveltekit-invalidated=01";
  const outstanding = cachedPublicNavigationFetch(
    async () => response,
    url,
    undefined,
    noon,
  );
  await reading.promise;
  clearPublicNavigationCache();
  body.resolve(bytes);
  await outstanding;
  const fresh = vi.fn(async () => jsonResponse({ page: "fresh" }));
  await cachedPublicNavigationFetch(fresh, url, undefined, noon);
  expect(fresh).toHaveBeenCalledTimes(1);
});

test.each([
  { path: "/api/auth/sign-out", method: "POST", status: 200, cleared: true },
  { path: "/account/sign-out", method: "POST", status: 303, cleared: true },
  { path: "/api/auth/sign-out", method: "POST", status: 403, cleared: false },
  { path: "/account/sign-out", method: "GET", status: 200, cleared: false },
  {
    path: "/api/auth/sign-out-other",
    method: "POST",
    status: 200,
    cleared: false,
  },
  {
    path: "https://external.example/api/auth/sign-out",
    method: "POST",
    status: 200,
    cleared: false,
  },
])(
  "$method $path ($status) clears only successful same-origin sign-out",
  async ({ path, method, status, cleared }) => {
    vi.stubGlobal("location", new URL("https://life.example/privacy"));
    const fetcher = vi.fn(async () => jsonResponse({ page: "public" }));
    const cached = [
      { path: "/news", locale: "en-us" },
      { path: "/catalog/courses", locale: "zh-cn" },
    ];
    for (const entry of cached) {
      await cachedPublicNavigationFetch(
        fetcher,
        `${entry.path}/__data.json?x-sveltekit-invalidated=01`,
        undefined,
        noon,
        entry.locale,
      );
    }
    const response = new Response(null, { status });
    const signOut = vi.fn(async () => response);
    const init = { method };
    expect(await cachedPublicNavigationFetch(signOut, path, init, noon)).toBe(
      response,
    );
    expect(signOut).toHaveBeenCalledWith(path, init);
    for (const entry of cached) {
      await cachedPublicNavigationFetch(
        fetcher,
        `${entry.path}/__data.json?x-sveltekit-invalidated=01`,
        undefined,
        noon,
        entry.locale,
      );
    }
    expect(fetcher).toHaveBeenCalledTimes(cleared ? 4 : 2);
  },
);

test("rendering-and-cache.cacheable-public-pages-15", async () => {
  const courseUrl =
    "https://life.example/catalog/courses/__data.json?x-sveltekit-invalidated=01";
  const fetchCourse = vi.fn(async () => jsonResponse({ page: "courses" }));
  const first = await cachedPublicNavigationFetch(
    fetchCourse,
    courseUrl,
    undefined,
    noon,
    "zh-cn",
  );
  const second = await cachedPublicNavigationFetch(
    fetchCourse,
    courseUrl,
    undefined,
    noon + 1_000,
    "zh-cn",
  );
  expect(fetchCourse).toHaveBeenCalledTimes(1);
  expect((await second.json()).nodes[1].data[0]).toEqual({ page: "courses" });
  expect(first.headers.get("content-type")).toContain("application/json");

  const otherLocale = vi.fn(async () => jsonResponse({ page: "courses-en" }));
  await cachedPublicNavigationFetch(
    otherLocale,
    courseUrl,
    undefined,
    noon,
    "en-us",
  );
  expect(otherLocale).toHaveBeenCalledTimes(1);

  const refreshed = vi.fn(async () => jsonResponse({ page: "courses-new" }));
  await cachedPublicNavigationFetch(
    refreshed,
    "https://life.example/catalog/courses/__data.json?x-sveltekit-invalidated=11",
    undefined,
    noon + 2_000,
    "zh-cn",
  );
  const afterEdit = await cachedPublicNavigationFetch(
    refreshed,
    courseUrl,
    undefined,
    noon + 3_000,
    "zh-cn",
  );
  expect(refreshed).toHaveBeenCalledTimes(2);
  expect((await afterEdit.json()).nodes[1].data[0]).toEqual({
    page: "courses-new",
  });

  const young = vi.fn(async () => jsonResponse({ page: "young" }));
  const youngUrl =
    "https://life.example/catalog/young-events/__data.json?x-sveltekit-invalidated=01";
  await cachedPublicNavigationFetch(young, youngUrl, undefined, noon, "zh-cn");
  await cachedPublicNavigationFetch(
    young,
    youngUrl,
    undefined,
    noon + 60_000,
    "zh-cn",
  );
  expect(young).toHaveBeenCalledTimes(2);

  const section = vi.fn(async () => jsonResponse({ page: "section" }));
  const sectionUrl =
    "https://life.example/catalog/sections/12/__data.json?x-sveltekit-invalidated=01";
  await cachedPublicNavigationFetch(
    section,
    sectionUrl,
    undefined,
    beforeMidnight,
    "zh-cn",
  );
  await cachedPublicNavigationFetch(
    section,
    sectionUrl,
    undefined,
    beforeMidnight + 10_000,
    "zh-cn",
  );
  expect(section).toHaveBeenCalledTimes(2);

  for (const path of [
    "/workspace/overview/__data.json?x-sveltekit-invalidated=01",
    "/catalog/bus/__data.json?x-sveltekit-invalidated=01",
    "/catalog/weather/__data.json?x-sveltekit-invalidated=01",
    "/__data.json?x-sveltekit-invalidated=01",
  ]) {
    const fetcher = vi.fn(async () => jsonResponse({ path }));
    const url = `https://life.example${path}`;
    await cachedPublicNavigationFetch(fetcher, url, undefined, noon, "zh-cn");
    await cachedPublicNavigationFetch(fetcher, url, undefined, noon, "zh-cn");
    expect(fetcher, path).toHaveBeenCalledTimes(2);
  }

  const cookied = vi.fn(async () =>
    jsonResponse({ page: "news" }, { [PUBLIC_NAVIGATION_HEADER]: "" }),
  );
  const newsUrl =
    "https://life.example/news/story/__data.json?x-sveltekit-invalidated=01";
  await cachedPublicNavigationFetch(cookied, newsUrl, undefined, noon, "zh-cn");
  await cachedPublicNavigationFetch(cookied, newsUrl, undefined, noon, "zh-cn");
  expect(cookied).toHaveBeenCalledTimes(2);
});

test("forwards sign-out Request bodies without consuming them", async () => {
  vi.stubGlobal("location", new URL("https://life.example/privacy"));
  const request = new Request("https://life.example/api/auth/sign-out", {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json" },
  });
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    expect(input).toBe(request);
    expect(request.bodyUsed).toBe(false);
    expect(await request.text()).toBe("{}");
    return Response.json({ success: true });
  });
  await cachedPublicNavigationFetch(fetcher, request, undefined, noon);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each([
  { type: "redirect", location: "/account/welcome" },
  {
    type: "data",
    nodes: [{ type: "error", status: 403, error: { message: "Forbidden" } }],
  },
  {
    type: "data",
    nodes: [
      { type: "data", data: [{}] },
      { type: "error", status: 500 },
    ],
  },
  { type: "data", nodes: [{ type: "unexpected" }] },
  { type: "data", nodes: [{ type: "data" }] },
  { type: "data" },
  {},
  null,
])("does not retain unsuccessful SvelteKit envelopes: %j", async (body) => {
  const fetcher = vi.fn(async () =>
    Response.json(body, {
      headers: { [PUBLIC_NAVIGATION_HEADER]: "1" },
    }),
  );
  const url =
    "https://life.example/news/__data.json?x-sveltekit-invalidated=01";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await cachedPublicNavigationFetch(
      fetcher,
      url,
      undefined,
      noon,
    );
    expect(await response.json()).toEqual(body);
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test.each([
  { type: "application/json", body: "malformed" },
  {
    type: "text/sveltekit-data",
    body: '{"type":"data","nodes":[{"type":"data","data":[{"later":1},["Promise",1]]}]}\n{"type":"chunk","id":1,"error":[{"message":1},"failed"]}\n',
  },
])("preserves uncached protocol bodies for $type", async ({ type, body }) => {
  const fetcher = vi.fn(
    async () =>
      new Response(body, {
        headers: { "content-type": type, [PUBLIC_NAVIGATION_HEADER]: "1" },
      }),
  );
  const url =
    "https://life.example/news/__data.json?x-sveltekit-invalidated=01";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await cachedPublicNavigationFetch(
      fetcher,
      url,
      undefined,
      noon,
    );
    expect(await response.text()).toBe(body);
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("does not consume a streaming response before returning it", async () => {
  const response = new Response(new ReadableStream(), {
    headers: {
      "content-type": "text/sveltekit-data",
      [PUBLIC_NAVIGATION_HEADER]: "1",
    },
  });
  const returned = await cachedPublicNavigationFetch(
    async () => response,
    "https://life.example/news/__data.json?x-sveltekit-invalidated=01",
    undefined,
    noon,
  );
  expect(returned).toBe(response);
  expect(response.bodyUsed).toBe(false);
  await response.body?.cancel();
});

test("expires date-sensitive data at midnight even with less than one second left", async () => {
  const now = Date.parse("2026-09-28T15:59:59.900Z");
  for (const path of [
    "/catalog/sections/12",
    "/catalog/young-events/calendar",
  ]) {
    const fetcher = vi.fn(async () => jsonResponse({ day: "2026-09-28" }));
    const url = `https://life.example${path}/__data.json?x-sveltekit-invalidated=01`;
    await cachedPublicNavigationFetch(fetcher, url, undefined, now);
    await cachedPublicNavigationFetch(fetcher, url, undefined, now + 99);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await cachedPublicNavigationFetch(fetcher, url, undefined, now + 100);
    expect(fetcher).toHaveBeenCalledTimes(2);
  }
});

test("keeps different partial invalidation node masks separate", async () => {
  const fetcher = vi.fn(async () => jsonResponse({ page: "courses" }));
  for (const mask of ["01", "10", "01", "10"]) {
    await cachedPublicNavigationFetch(
      fetcher,
      `https://life.example/catalog/courses/__data.json?x-sveltekit-invalidated=${mask}`,
      undefined,
      noon,
      "zh-cn",
    );
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("isolates cached navigation data and full invalidation by origin", async () => {
  const external = "https://external.example";
  const local = "https://life.example";
  const path = "/news/__data.json?x-sveltekit-invalidated=";
  const fetcher = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse({ origin: new URL(String(input)).origin }),
  );
  for (const origin of [external, local, external, local]) {
    const response = await cachedPublicNavigationFetch(
      fetcher,
      `${origin}${path}01`,
      undefined,
      noon,
      "zh-cn",
    );
    expect((await response.json()).nodes[1].data[0]).toEqual({ origin });
  }
  expect(fetcher).toHaveBeenCalledTimes(2);

  await cachedPublicNavigationFetch(
    fetcher,
    `${external}${path}11`,
    undefined,
    noon,
    "zh-cn",
  );
  await cachedPublicNavigationFetch(
    fetcher,
    `${local}${path}01`,
    undefined,
    noon,
    "zh-cn",
  );
  expect(fetcher).toHaveBeenCalledTimes(3);
  await cachedPublicNavigationFetch(
    fetcher,
    `${external}${path}01`,
    undefined,
    noon,
    "zh-cn",
  );
  expect(fetcher).toHaveBeenCalledTimes(4);
});
