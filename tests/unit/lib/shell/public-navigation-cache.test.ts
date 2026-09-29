import { beforeEach, expect, test, vi } from "vitest";
import {
  cachedPublicNavigationFetch,
  resetPublicNavigationCacheForTests,
} from "@/lib/shell/public-navigation-cache";

const noon = Date.parse("2026-09-28T04:00:00.000Z");
const beforeMidnight = Date.parse("2026-09-28T15:59:50.000Z");

function jsonResponse(body: unknown, headers?: HeadersInit) {
  return Response.json(body, { headers });
}

beforeEach(() => {
  resetPublicNavigationCacheForTests();
});

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
  expect(await second.json()).toEqual({ page: "courses" });
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
  expect(await afterEdit.json()).toEqual({ page: "courses-new" });

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
    jsonResponse({ page: "news" }, { "set-cookie": "theme=dark" }),
  );
  const newsUrl =
    "https://life.example/news/story/__data.json?x-sveltekit-invalidated=01";
  await cachedPublicNavigationFetch(cookied, newsUrl, undefined, noon, "zh-cn");
  await cachedPublicNavigationFetch(cookied, newsUrl, undefined, noon, "zh-cn");
  expect(cookied).toHaveBeenCalledTimes(2);
});
